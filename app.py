from flask import Flask, request, jsonify, session, send_from_directory # type: ignore
from flask_cors import CORS # type: ignore
import mysql.connector # type: ignore
from werkzeug.security import generate_password_hash, check_password_hash  # type: ignore
from werkzeug.utils import secure_filename  # type: ignore
from datetime import date, timedelta
from config import DB_CONFIG, SECRET_KEY
import os
import uuid

app = Flask(__name__, static_folder='static')
app.secret_key = SECRET_KEY
CORS(app, supports_credentials=True, origins=["http://localhost:5173"])

app.config.update(
    SESSION_COOKIE_NAME="ehr_session",
    SESSION_COOKIE_SAMESITE="LAX",   # allow cross-site cookie
    SESSION_COOKIE_SECURE=False,      # True only when using https
    SESSION_COOKIE_HTTPONLY=True,
    PERMANENT_SESSION_LIFETIME=timedelta(hours=6),
)

# Configure upload folder
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create upload folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_db():
    return mysql.connector.connect(**DB_CONFIG)


# ---------- AUTH (simple) ----------

@app.route("/api/me", methods=["GET"])
def me():
    if "doctor_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({"doctor_id": session["doctor_id"]})

@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    doctor_number = data.get("doctor_number")
    password = data.get("password")

    if not (name and email and doctor_number and password):
        return jsonify({"error": "Missing fields"}), 400
    # Password strength check
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO doctors (name, email, doctor_number, password_hash)
            VALUES (%s, %s, %s, %s)
            """,
            (name, email, doctor_number, generate_password_hash(password)),
        )
        conn.commit()
        return jsonify({"message": "Doctor registered"}), 201
    except mysql.connector.Error as e:
        conn.rollback()
        # Duplicate entry for doctor_number or email gives friendlier error
        if hasattr(e, 'errno') and e.errno == 1062:
            error_str = str(e)
            if 'doctor_number' in error_str:
                return jsonify({"error": "Doctor number already exists."}), 400
            if 'email' in error_str:
                return jsonify({"error": "Email already exists."}), 400
        return jsonify({"error": str(e)}), 400
    finally:
        cur.close()
        conn.close()


@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    doctor_number = data.get("doctor_number")
    password = data.get("password")

    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT * FROM doctors WHERE doctor_number = %s", (doctor_number,)
    )
    doctor = cur.fetchone()
    cur.close()
    conn.close()

    if doctor and check_password_hash(doctor["password_hash"], password):
        session.permanent = True
        session["doctor_id"] = doctor["id"]
        return jsonify({"message": "Logged in", "doctor": {"id": doctor["id"], "name": doctor["name"]}})
    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})


@app.route("/api/check-auth", methods=["GET"])
def check_auth():
    """Check if user is authenticated"""
    if "doctor_id" not in session:
        return jsonify({"authenticated": False}), 401
    return jsonify({"authenticated": True, "doctor_id": session["doctor_id"]})


def require_login():
    if "doctor_id" not in session:
        return False, jsonify({"error": "Not authenticated"}), 401
    return True, session["doctor_id"], None


# ---------- PATIENT SEARCH & VERIFICATION ----------

@app.route("/api/patients/search", methods=["GET"])
def search_patient():
    """Step 1: Patient lookup using insurance number"""
    ok, doc_or_resp, code = require_login()
    if not ok:
        return doc_or_resp, code
    doctor_id = doc_or_resp
    
    insurance_number = request.args.get("insurance_number")
    if not insurance_number:
        return jsonify({"error": "Insurance number required"}), 400
    
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        """
        SELECT id, first_name, last_name, birth_date, insurance_number, doctor_id
        FROM patients 
        WHERE insurance_number = %s AND doctor_id = %s
        """,
        (insurance_number, doctor_id)
    )
    patient = cur.fetchone()
    cur.close()
    conn.close()
    
    if patient:
        # Convert date to string for JSON
        if patient.get("birth_date"):
            patient["birth_date"] = str(patient["birth_date"])
        return jsonify({"found": True, "patient": patient})
    else:
        return jsonify({"found": False, "insurance_number": insurance_number})


@app.route("/api/patients/verify", methods=["POST"])
def verify_patient():
    """Step 2: Verify patient match using 2 identifiers (insurance_number + DOB)"""
    ok, doc_or_resp, code = require_login()
    if not ok:
        return doc_or_resp, code
    doctor_id = doc_or_resp
    
    data = request.json
    insurance_number = data.get("insurance_number")
    birth_date = data.get("birth_date")
    
    if not (insurance_number and birth_date):
        return jsonify({"error": "Insurance number and birth date required"}), 400
    
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        """
        SELECT id, first_name, last_name, birth_date, insurance_number, doctor_id
        FROM patients 
        WHERE insurance_number = %s AND birth_date = %s AND doctor_id = %s
        """,
        (insurance_number, birth_date, doctor_id)
    )
    patient = cur.fetchone()
    
    if patient:
        # Get visit history
        cur.execute(
            """
            SELECT v.id, v.visit_date, v.visit_type, v.chief_complaint, v.notes,
                   COUNT(d.id) as document_count
            FROM visits v
            LEFT JOIN documents d ON v.id = d.visit_id
            WHERE v.patient_id = %s
            GROUP BY v.id
            ORDER BY v.visit_date DESC
            LIMIT 10
            """,
            (patient["id"],)
        )
        visits = cur.fetchall()
        
        # Convert dates to strings
        if patient.get("birth_date"):
            patient["birth_date"] = str(patient["birth_date"])
        for visit in visits:
            if visit.get("visit_date"):
                visit["visit_date"] = str(visit["visit_date"])
        
        cur.close()
        conn.close()
        return jsonify({
            "verified": True,
            "patient": patient,
            "visits": visits
        })
    else:
        cur.close()
        conn.close()
        return jsonify({"verified": False, "error": "Patient not found with matching identifiers"})


# ---------- PATIENT CRUD ----------

@app.route("/api/patients", methods=["POST"])
def create_patient():
    """Step 3: Create new patient"""
    ok, doc_or_resp, code = require_login()
    if not ok:
        return doc_or_resp, code
    doctor_id = doc_or_resp
    
    data = request.json
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    birth_date = data.get("birth_date")
    insurance_number = data.get("insurance_number")
    
    if not (first_name and last_name and birth_date and insurance_number):
        return jsonify({"error": "Missing required fields"}), 400
    
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    try:
        # Check if insurance number already exists
        cur.execute(
            "SELECT id FROM patients WHERE insurance_number = %s AND doctor_id = %s",
            (insurance_number, doctor_id)
        )
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"error": "Patient with this insurance number already exists"}), 400
        
        cur.execute(
            """
            INSERT INTO patients (doctor_id, first_name, last_name, birth_date, insurance_number)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (doctor_id, first_name, last_name, birth_date, insurance_number)
        )
        conn.commit()
        patient_id = cur.lastrowid
        
        cur.execute(
            "SELECT * FROM patients WHERE id = %s",
            (patient_id,)
        )
        patient = cur.fetchone()
        if patient.get("birth_date"):
            patient["birth_date"] = str(patient["birth_date"])
        
        cur.close()
        conn.close()
        return jsonify({"message": "Patient created", "patient": patient}), 201
    except mysql.connector.Error as e:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({"error": str(e)}), 400


@app.route("/api/patients/<int:patient_id>", methods=["GET"])
def get_patient(patient_id):
    """Get patient details with visit history"""
    ok, doc_or_resp, code = require_login()
    if not ok:
        return doc_or_resp, code
    doctor_id = doc_or_resp
    
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    
    # Get patient
    cur.execute(
        "SELECT * FROM patients WHERE id = %s AND doctor_id = %s",
        (patient_id, doctor_id)
    )
    patient = cur.fetchone()
    
    if not patient:
        cur.close()
        conn.close()
        return jsonify({"error": "Patient not found"}), 404
    
    # Get visit history
    cur.execute(
        """
        SELECT v.*, COUNT(d.id) as document_count
        FROM visits v
        LEFT JOIN documents d ON v.id = d.visit_id
        WHERE v.patient_id = %s
        GROUP BY v.id
        ORDER BY v.visit_date DESC
        """,
        (patient_id,)
    )
    visits = cur.fetchall()
    
    # Convert dates
    if patient.get("birth_date"):
        patient["birth_date"] = str(patient["birth_date"])
    for visit in visits:
        if visit.get("visit_date"):
            visit["visit_date"] = str(visit["visit_date"])
        if visit.get("created_at"):
            visit["created_at"] = str(visit["created_at"])
    
    cur.close()
    conn.close()
    return jsonify({"patient": patient, "visits": visits})


@app.route("/api/patients/<int:patient_id>", methods=["PUT"])
def update_patient(patient_id):
    """Update patient information"""
    ok, doc_or_resp, code = require_login()
    if not ok:
        return doc_or_resp, code
    doctor_id = doc_or_resp
    
    data = request.json
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Verify patient belongs to doctor
        cur.execute(
            "SELECT id FROM patients WHERE id = %s AND doctor_id = %s",
            (patient_id, doctor_id)
        )
        if not cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"error": "Patient not found"}), 404
        
        # Update patient
        cur.execute(
            """
            UPDATE patients 
            SET first_name = %s, last_name = %s, birth_date = %s, insurance_number = %s
            WHERE id = %s
            """,
            (
                data.get("first_name"),
                data.get("last_name"),
                data.get("birth_date"),
                data.get("insurance_number"),
                patient_id
            )
        )
        conn.commit()
        
        cur.execute("SELECT * FROM patients WHERE id = %s", (patient_id,))
        patient = cur.fetchone()
        if patient.get("birth_date"):
            patient["birth_date"] = str(patient["birth_date"])
        
        cur.close()
        conn.close()
        return jsonify({"message": "Patient updated", "patient": patient})
    except mysql.connector.Error as e:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({"error": str(e)}), 400


@app.route("/api/patients/<int:patient_id>", methods=["DELETE"])
def delete_patient(patient_id):
    """Delete patient (cascade will delete visits and documents)"""
    ok, doc_or_resp, code = require_login()
    if not ok:
        return doc_or_resp, code
    doctor_id = doc_or_resp
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Verify patient belongs to doctor
        cur.execute(
            "SELECT id FROM patients WHERE id = %s AND doctor_id = %s",
            (patient_id, doctor_id)
        )
        if not cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"error": "Patient not found"}), 404
        
        cur.execute("DELETE FROM patients WHERE id = %s", (patient_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "Patient deleted"})
    except mysql.connector.Error as e:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({"error": str(e)}), 400


# ---------- VISIT/ENCOUNTER CRUD ----------

@app.route("/api/patients/<int:patient_id>/visits", methods=["POST"])
def create_visit(patient_id):
    """Step 4: Create a new visit/encounter"""
    ok, doc_or_resp, code = require_login()
    if not ok:
        return doc_or_resp, code
    doctor_id = doc_or_resp
    
    # Verify patient belongs to doctor
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id FROM patients WHERE id = %s AND doctor_id = %s",
            (patient_id, doctor_id)
        )
        if not cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"error": "Patient not found"}), 404
        
        cur.close()  # Close first cursor before creating new one
        
        data = request.json
        visit_date = data.get("visit_date", str(date.today()))
        visit_type = data.get("visit_type", "general")
        chief_complaint = data.get("chief_complaint", "")
        notes = data.get("notes", "")
        
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(
                """
                INSERT INTO visits (patient_id, visit_date, visit_type, chief_complaint, notes)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (patient_id, visit_date, visit_type, chief_complaint, notes)
            )
            conn.commit()
            visit_id = cur.lastrowid
            
            cur.execute("SELECT * FROM visits WHERE id = %s", (visit_id,))
            visit = cur.fetchone()
            if visit.get("visit_date"):
                visit["visit_date"] = str(visit["visit_date"])
            
            cur.close()
            conn.close()
            return jsonify({"message": "Visit created", "visit": visit}), 201
        except mysql.connector.Error as e:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": str(e)}), 400
    except mysql.connector.Error as e:
        if 'cur' in locals():
            cur.close()
        conn.close()
        return jsonify({"error": str(e)}), 400


@app.route("/api/visits/<int:visit_id>", methods=["GET"])
def get_visit(visit_id):
    """Get visit details with documents"""
    ok, doc_or_resp, code = require_login()
    if not ok:
        return doc_or_resp, code
    doctor_id = doc_or_resp
    
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    
    # Get visit and verify patient belongs to doctor
    cur.execute(
        """
        SELECT v.* FROM visits v
        JOIN patients p ON v.patient_id = p.id
        WHERE v.id = %s AND p.doctor_id = %s
        """,
        (visit_id, doctor_id)
    )
    visit = cur.fetchone()
    
    if not visit:
        cur.close()
        conn.close()
        return jsonify({"error": "Visit not found"}), 404
    
    # Get documents for this visit
    cur.execute(
        "SELECT * FROM documents WHERE visit_id = %s",
        (visit_id,)
    )
    documents = cur.fetchall()
    
    # Convert dates
    if visit.get("visit_date"):
        visit["visit_date"] = str(visit["visit_date"])
    for doc in documents:
        if doc.get("uploaded_at"):
            doc["uploaded_at"] = str(doc["uploaded_at"])
    
    cur.close()
    conn.close()
    return jsonify({"visit": visit, "documents": documents})


# ---------- DOCUMENT UPLOAD ----------

@app.route("/api/visits/<int:visit_id>/documents", methods=["POST"])
def upload_document(visit_id):
    """Upload document (image/PDF) for a visit"""
    ok, doc_or_resp, code = require_login()
    if not ok:
        return doc_or_resp, code
    doctor_id = doc_or_resp
    
    # Verify visit belongs to doctor's patient
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT v.patient_id FROM visits v
            JOIN patients p ON v.patient_id = p.id
            WHERE v.id = %s AND p.doctor_id = %s
            """,
            (visit_id, doctor_id)
        )
        result = cur.fetchone()
        if not result:
            cur.close()
            conn.close()
            return jsonify({"error": "Visit not found"}), 404
        
        patient_id = result[0]
        cur.close()  # Close first cursor before file operations
        
        if 'file' not in request.files:
            conn.close()
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            conn.close()
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            conn.close()
            return jsonify({"error": "File type not allowed"}), 400
        
        # Generate unique filename
        filename = secure_filename(file.filename)
        if not filename or '.' not in filename:
            conn.close()
            return jsonify({"error": "Invalid filename"}), 400
        
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        try:
            file.save(file_path)
        except Exception as e:
            conn.close()
            return jsonify({"error": f"Failed to save file: {str(e)}"}), 500
        
        # Get file info
        file_type = filename.rsplit('.', 1)[1].lower()
        file_size = os.path.getsize(file_path)
        description = request.form.get('description', '')
        
        # Save to database
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(
                """
                INSERT INTO documents (visit_id, patient_id, file_name, file_path, file_type, file_size, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (visit_id, patient_id, filename, file_path, file_type, file_size, description)
            )
            conn.commit()
            doc_id = cur.lastrowid
            
            cur.execute("SELECT * FROM documents WHERE id = %s", (doc_id,))
            document = cur.fetchone()
            if document.get("uploaded_at"):
                document["uploaded_at"] = str(document["uploaded_at"])
            
            cur.close()
            conn.close()
            return jsonify({"message": "Document uploaded", "document": document}), 201
        except mysql.connector.Error as e:
            conn.rollback()
            # Delete uploaded file if DB insert fails
            if os.path.exists(file_path):
                os.remove(file_path)
            cur.close()
            conn.close()
            return jsonify({"error": str(e)}), 400
    except Exception as e:
        # Handle any other unexpected errors
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


# ---------- PATIENT (for left panel header) - LEGACY ----------

@app.route("/api/patient/current", methods=["GET"])
def get_current_patient():
    ok, doc_or_resp, code = require_login()
    if not ok:
        return doc_or_resp, code
    doctor_id = doc_or_resp

    conn = get_db()
    cur = conn.cursor(dictionary=True)
    # for demo: take first patient of doctor
    cur.execute(
        "SELECT * FROM patients WHERE doctor_id = %s ORDER BY id LIMIT 1",
        (doctor_id,),
    )
    patient = cur.fetchone()
    cur.close()
    conn.close()

    if not patient:
        # create a demo patient if none
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """
            INSERT INTO patients (doctor_id, first_name, last_name, birth_date)
            VALUES (%s, %s, %s, %s)
            """,
            (doctor_id, "David", "Anderson", date(2009, 1, 5)),
        )
        conn.commit()
        patient_id = cur.lastrowid
        cur.close()
        conn.close()
        patient = {
            "id": patient_id,
            "doctor_id": doctor_id,
            "first_name": "David",
            "last_name": "Anderson",
            "birth_date": "2009-01-05",
        }

    return jsonify(patient)


# ---------- DIGESTIVE VISIT (center panel form) ----------

@app.route("/api/digestive/<int:patient_id>", methods=["GET"])
def get_digestive(patient_id):
    ok, doc_or_resp, code = require_login()
    if not ok:
        return doc_or_resp, code

    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT * FROM digestive_visit WHERE patient_id = %s ORDER BY id DESC LIMIT 1",
        (patient_id,),
    )
    visit = cur.fetchone()
    cur.close()
    conn.close()

    if not visit:
        # send defaults matching your React placeholders
        visit = {
            "id": None,
            "patient_id": patient_id,
            "visit_date": str(date.today()),
            "digestive_inspection": "Normal",
            "digestive_auscultation": "Normal abdomen noises",
            "digestive_palpation": "Little pain on the right lower area",
            "liver": "No hepatomegaly.",
            "rectal": "",
            "smoker": 0,
            "insurance_type": "public",
            "notes": "",
            "image_path": "",
        }

    return jsonify(visit)


@app.route("/api/digestive/<int:patient_id>", methods=["POST"])
def save_digestive(patient_id):
    ok, doc_or_resp, code = require_login()
    if not ok:
        return doc_or_resp, code

    data = request.json
    conn = get_db()
    cur = conn.cursor(dictionary=True)

    # check if already exists
    cur.execute(
        "SELECT id FROM digestive_visit WHERE patient_id = %s ORDER BY id DESC LIMIT 1",
        (patient_id,),
    )
    existing = cur.fetchone()

    fields = (
        data.get("visit_date"),
        data.get("digestive_inspection"),
        data.get("digestive_auscultation"),
        data.get("digestive_palpation"),
        data.get("liver"),
        data.get("rectal"),
        int(bool(data.get("smoker"))),
        data.get("insurance_type"),
        data.get("notes"),
        data.get("image_path", ""),
        patient_id,
    )

    try:
        if existing:
            cur.execute(
                """
                UPDATE digestive_visit
                SET visit_date=%s,
                    digestive_inspection=%s,
                    digestive_auscultation=%s,
                    digestive_palpation=%s,
                    liver=%s,
                    rectal=%s,
                    smoker=%s,
                    insurance_type=%s,
                    notes=%s,
                    image_path=%s
                WHERE patient_id=%s AND id=%s
                """,
                fields + (existing["id"],),
            )
        else:
            cur.execute(
                """
                INSERT INTO digestive_visit (
                    visit_date, digestive_inspection, digestive_auscultation,
                    digestive_palpation, liver, rectal,
                    smoker, insurance_type, notes, image_path, patient_id
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                fields,
            )
        conn.commit()
        return jsonify({"message": "Saved"}), 200
    except mysql.connector.Error as e:
        conn.rollback()
        # Duplicate entry for doctor_number or email gives friendlier error
        if hasattr(e, 'errno') and e.errno == 1062:
            error_str = str(e)
            if 'doctor_number' in error_str:
                return jsonify({"error": "Doctor number already exists."}), 400
            if 'email' in error_str:
                return jsonify({"error": "Email already exists."}), 400
        return jsonify({"error": str(e)}), 400
    finally:
        cur.close()
        conn.close()


# Serve uploaded files
@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == "__main__":
    app.run(debug=True)
