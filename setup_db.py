import mysql.connector
from config import DB_CONFIG

# Connect without database to create it
config_no_db = DB_CONFIG.copy()
config_no_db.pop("database")

conn = mysql.connector.connect(**config_no_db)
cur = conn.cursor()

try:
    cur.execute("CREATE DATABASE IF NOT EXISTS ehr_db CHARACTER SET utf8mb4")
    conn.commit()
    print("Database created.")
except mysql.connector.Error as e:
    print(f"Error: {e}")

cur.close()
conn.close()

# Now connect to the database and create tables
conn = mysql.connector.connect(**DB_CONFIG)
cur = conn.cursor()

tables = [
    """
    CREATE TABLE IF NOT EXISTS doctors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doctor_number VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(120) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS patients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doctor_id INT NOT NULL,
      first_name VARCHAR(50),
      last_name VARCHAR(50),
      birth_date DATE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS digestive_visit (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      visit_date DATE,
      digestive_inspection VARCHAR(255),
      digestive_auscultation VARCHAR(255),
      digestive_palpation VARCHAR(255),
      liver VARCHAR(255),
      rectal VARCHAR(255),
      smoker TINYINT(1) DEFAULT 0,
      insurance_type VARCHAR(20),
      notes TEXT,
      image_path VARCHAR(255),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    )
    """
]

try:
    for table in tables:
        cur.execute(table)
    conn.commit()
    print("Tables created successfully.")
except mysql.connector.Error as e:
    print(f"Error: {e}")
finally:
    cur.close()
    conn.close()
