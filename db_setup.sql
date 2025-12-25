CREATE DATABASE ehr_db CHARACTER SET utf8mb4;
USE ehr_db;

CREATE TABLE doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_number VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  UNIQUE KEY uniq_doctor_number (doctor_number),
  UNIQUE KEY uniq_doctor_email (email)
);

CREATE TABLE patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  birth_date DATE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE digestive_visit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  visit_date DATE,
  digestive_inspection VARCHAR(255),
  digestive_auscultation VARCHAR(255),
  digestive_palpation VARCHAR(255),
  liver VARCHAR(255),
  rectal VARCHAR(255),
  smoker TINYINT(1) DEFAULT 0,           -- checkbox example
  insurance_type VARCHAR(20),            -- radio example
  notes TEXT,
  image_path VARCHAR(255),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);
