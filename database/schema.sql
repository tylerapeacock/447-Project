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


CREATE TABLE metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    department_id INT NOT NULL,
    metric_name VARCHAR(150) NOT NULL,
    date DATE NOT NULL,
    count INT NOT NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);


-- ============================================================
-- table for uploads (csv)
-- ============================================================

CREATE TABLE uploads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    department_id INT NOT NULL,
    uploaded_by INT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    filename VARCHAR(255),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);