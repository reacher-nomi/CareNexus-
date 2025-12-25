"""
Database migration script
Adds insurance_number, visits, documents, and ehr_data tables
"""
import mysql.connector
from config import DB_CONFIG

def migrate():
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    migrations = [
        # Add insurance_number column if not exists
        """
        SELECT COUNT(*) FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'ehr_db' 
        AND TABLE_NAME = 'patients' 
        AND COLUMN_NAME = 'insurance_number'
        """,
        
        # Add insurance_number
        """
        ALTER TABLE patients 
        ADD COLUMN insurance_number VARCHAR(50) UNIQUE AFTER birth_date
        """,
        
        # Create index for insurance_number if not exists
        """
        CREATE INDEX IF NOT EXISTS idx_insurance_number ON patients(insurance_number)
        """,
        
        # Create index for insurance_number + birth_date
        """
        CREATE INDEX IF NOT EXISTS idx_insurance_dob ON patients(insurance_number, birth_date)
        """,
        
        # Create visits table
        """
        CREATE TABLE IF NOT EXISTS visits (
          id INT AUTO_INCREMENT PRIMARY KEY,
          patient_id INT NOT NULL,
          visit_date DATE NOT NULL,
          visit_type VARCHAR(50) DEFAULT 'general',
          chief_complaint TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
          INDEX idx_patient_visit_date (patient_id, visit_date)
        )
        """,
        
        # Create documents table
        """
        CREATE TABLE IF NOT EXISTS documents (
          id INT AUTO_INCREMENT PRIMARY KEY,
          visit_id INT NOT NULL,
          patient_id INT NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_type VARCHAR(50),
          file_size INT,
          description TEXT,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
          INDEX idx_visit_documents (visit_id),
          INDEX idx_patient_documents (patient_id)
        )
        """,
        
        # Create ehr_data table
        """
        CREATE TABLE IF NOT EXISTS ehr_data (
          id INT AUTO_INCREMENT PRIMARY KEY,
          visit_id INT NOT NULL,
          patient_id INT NOT NULL,
          first_name VARCHAR(50),
          last_name VARCHAR(50),
          birth_date DATE,
          gender VARCHAR(20),
          phone VARCHAR(20),
          email VARCHAR(120),
          address TEXT,
          emergency_contact_name VARCHAR(100),
          emergency_contact_phone VARCHAR(20),
          blood_pressure_systolic INT,
          blood_pressure_diastolic INT,
          temperature DECIMAL(4,2),
          heart_rate INT,
          weight DECIMAL(5,2),
          height DECIMAL(5,2),
          oxygen_saturation INT,
          past_illnesses TEXT,
          surgeries TEXT,
          family_history TEXT,
          chronic_conditions TEXT,
          current_medications TEXT,
          allergies TEXT,
          has_allergies TINYINT(1) DEFAULT 0,
          immunizations TEXT,
          lab_tests TEXT,
          lab_results TEXT,
          diagnosis TEXT,
          treatment_plan TEXT,
          follow_up_date DATE,
          smoker TINYINT(1) DEFAULT 0,
          insurance_type VARCHAR(20),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
          FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
          INDEX idx_visit_ehr (visit_id),
          INDEX idx_patient_ehr (patient_id)
        )
        """
    ]
    
    try:
        # Check if insurance_number column exists
        cur.execute(migrations[0])
        result = cur.fetchone()
        
        if result[0] == 0:
            print("Adding insurance_number column to patients table...")
            cur.execute(migrations[1])
            print("[OK] Added insurance_number column")
        else:
            print("[OK] insurance_number column already exists")
        
        # Create indexes (will fail silently if exists, which is fine)
        try:
            cur.execute(migrations[2])
            cur.execute(migrations[3])
            print("[OK] Created indexes")
        except:
            pass
        
        # Create visits table
        print("Creating visits table...")
        cur.execute(migrations[4])
        print("[OK] Created visits table")
        
        # Create documents table
        print("Creating documents table...")
        cur.execute(migrations[5])
        print("[OK] Created documents table")
        
        # Create ehr_data table
        print("Creating ehr_data table...")
        cur.execute(migrations[6])
        print("[OK] Created ehr_data table")
        
        conn.commit()
        print("\n[SUCCESS] Migration completed successfully!")
        
    except mysql.connector.Error as e:
        conn.rollback()
        print(f"[ERROR] Error during migration: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate()

