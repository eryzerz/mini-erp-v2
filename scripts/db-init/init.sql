-- One Postgres instance; one database per service.
SELECT 'CREATE DATABASE slm_auth' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'slm_auth')\gexec
SELECT 'CREATE DATABASE slm_customers' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'slm_customers')\gexec
SELECT 'CREATE DATABASE slm_invoices' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'slm_invoices')\gexec
SELECT 'CREATE DATABASE slm_auth_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'slm_auth_test')\gexec
SELECT 'CREATE DATABASE slm_customers_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'slm_customers_test')\gexec
SELECT 'CREATE DATABASE slm_invoices_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'slm_invoices_test')\gexec
