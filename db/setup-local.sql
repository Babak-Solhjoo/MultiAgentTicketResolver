CREATE DATABASE IF NOT EXISTS ticket_handler;

CREATE USER IF NOT EXISTS 'ticket_handler'@'localhost' IDENTIFIED BY 'ticket_handler_pass';
GRANT ALL PRIVILEGES ON ticket_handler.* TO 'ticket_handler'@'localhost';
FLUSH PRIVILEGES;

USE ticket_handler;

SOURCE init.sql;
