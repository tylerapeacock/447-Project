-- ============================================================
-- database.sql
-- CMSC 447 - Sprint 1
-- ============================================================

CREATE DATABASE IF NOT EXISTS retriever_dashboard;

USE retriever_dashboard;

-- ============================================================
-- table for departments
-- includes retriervier essentials and retriever care
-- ============================================================


CREATE TABLE departments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE
);


-- ============================================================
-- table for users of the dashboard
-- ============================================================


CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    role ENUM('dean', 'vp', 'director', 'assistant_director') NOT NULL,
    department_id INT,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- ============================================================
-- table for metrics
-- ============================================================

CREATE TABLE metric_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    department_id INT NOT NULL,
    metric_type_id INT NOT NULL,
    metric_date DATE NOT NULL,
    count INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (metric_type_id) REFERENCES metric_types(id)
);


-- ============================================================
-- table for uploads (csv)
-- ============================================================


CREATE TABLE uploads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    department_id INT NOT NULL,
    uploaded_by INT NOT NULL,
    filename VARCHAR(255),
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    row_count INT,
    status ENUM('success', 'partial', 'failed') DEFAULT 'success',
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
 

CREATE TABLE upload_errors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    upload_id INT NOT NULL,
    row_number INT,
    error_message VARCHAR(255),
    FOREIGN KEY (upload_id) REFERENCES uploads(id)
);


CREATE TABLE demographics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    metric_id INT NOT NULL,
    category VARCHAR(100) NOT NULL,   -- year or age range
    value VARCHAR(100) NOT NULL,      -- ass range or class
    count INT NOT NULL,
    FOREIGN KEY (metric_id) REFERENCES metrics(id)
);