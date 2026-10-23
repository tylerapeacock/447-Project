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
    password_hash VARCHAR(255) NOT NULL,   -- bcrypt hash, never a plain password
    role ENUM('dean', 'vp', 'director', 'assistant_director', 'department_administrator') NOT NULL,
    -- dean, vp, director, assistant_director: read-only, portfolio-wide (department_id stays NULL)
    -- department_administrator: read/write, scoped to their own department (department_id required)
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





INSERT INTO departments (name) VALUES
('Retriever Essentials'),
('Retriever Care'),
('Engagement and Belonging'),
('Dean of Students Office');


INSERT INTO metric_types (name, description) VALUES
('Students Served', 'Total unique students served by the department'),
('SNAP Connections', 'Number of students connected with SNAP benefits'),
('Benefits Screenings', 'Number of students screened for benefits eligibility'),
('Crisis Resources Guided', 'Number of students guided through crisis resources'),
('Visitation Frequency', 'Number of visits/check-ins by students'),
('Meal Swipes Donated', 'Number of meal swipes donated by students'),
('Meal Swipes Received', 'Number of meal swipes received by students in need'),
('Care Team Contacts', 'Number of one-on-one social worker connections');


-- Every seeded account has the development password: 1234
-- The hash below is bcrypt("1234"). Development only - real accounts
-- will get their own hashes created through the application.
INSERT INTO users (name, email, password_hash, role, department_id) VALUES
('Test Admin', '1234', '$2b$12$fjZamqSaUW3o/UihweQ1P.3WHGMGE6SIVr3lvAqz3HN81Ew.0WUg6', 'department_administrator', 1),
('Joe Joe', 'jj@umbc.edu', '$2b$12$fjZamqSaUW3o/UihweQ1P.3WHGMGE6SIVr3lvAqz3HN81Ew.0WUg6', 'dean', NULL),
('Sample VP', 'vp@umbc.edu', '$2b$12$fjZamqSaUW3o/UihweQ1P.3WHGMGE6SIVr3lvAqz3HN81Ew.0WUg6', 'vp', NULL),
('Retriever Essentials Director', 'essentials_dir@umbc.edu', '$2b$12$fjZamqSaUW3o/UihweQ1P.3WHGMGE6SIVr3lvAqz3HN81Ew.0WUg6', 'director', NULL),
('Retriever Care Director', 'care_dir@umbc.edu', '$2b$12$fjZamqSaUW3o/UihweQ1P.3WHGMGE6SIVr3lvAqz3HN81Ew.0WUg6', 'director', NULL),
('Retriever Essentials Admin', 'essentials_admin@umbc.edu', '$2b$12$fjZamqSaUW3o/UihweQ1P.3WHGMGE6SIVr3lvAqz3HN81Ew.0WUg6', 'department_administrator', 1),
('Retriever Care Admin', 'care_admin@umbc.edu', '$2b$12$fjZamqSaUW3o/UihweQ1P.3WHGMGE6SIVr3lvAqz3HN81Ew.0WUg6', 'department_administrator', 2);


INSERT INTO metrics (department_id, metric_type_id, metric_date, count) VALUES
(1, 1, '2026-09-01', 300),   -- Retriever Essentials - Students Served
(1, 2, '2026-09-01', 10),    -- Retriever Essentials - SNAP Connections
(1, 3, '2026-09-01', 45),    -- Retriever Essentials - Benefits Screenings
(1, 6, '2026-09-01', 120),   -- Retriever Essentials - Meal Swipes Donated
(1, 7, '2026-09-01', 95),    -- Retriever Essentials - Meal Swipes Received
(2, 4, '2026-09-01', 50),    -- Retriever Care - Crisis Resources Guided
(2, 8, '2026-09-01', 20),    -- Retriever Care - Care Team Contacts
(3, 5, '2026-09-01', 200);   -- Engagement and Belonging - Visitation Frequency