-- ============================================================
-- database.sql
-- CMSC 447 - Sprint 1
-- ============================================================

CREATE DATABASE IF NOT EXISTS retriever_dashboard;

USE retriever_dashboard;

-- ============================================================
-- table for departments
-- ============================================================


CREATE TABLE departments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- ============================================================
-- table for student information
-- ============================================================


CREATE TABLE studentInfo(
    id INT PRIMARY KEY UNIQUE,
    name VARCHAR(100) NOT NULL UNIQUE
);


-- ============================================================
-- table for 
-- ============================================================


CREATE TABLE (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE
);
