-- ==============================================================================
-- Migration: 013_schedules_and_priorities.sql
-- Description: Menambahkan tabel schedules (jadwal/agenda) terpisah, 
--              kolom priority di reminders, dan relasi schedule_id.
--              Membedakan secara tegas: Tugas (Tasks), Jadwal (Schedules), dan Pengingat (Reminders).
-- ==============================================================================

-- 1. Buat Tabel: schedules (Jadwal Kegiatan, Acara, Rapat & Agenda)
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NULL,
    location VARCHAR(255) NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'URGENT'
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- 2. Tambah kolom priority dan relasi schedule_id ke tabel reminders
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'MEDIUM';
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS schedule_id INT NULL REFERENCES schedules(id) ON DELETE SET NULL;

-- 3. Standarisasi default priority di tabel tasks
ALTER TABLE tasks ALTER COLUMN priority SET DEFAULT 'MEDIUM';

-- 4. Indeks untuk Query & Performa Tinggi
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_start_time ON schedules(start_time);
CREATE INDEX IF NOT EXISTS idx_schedules_priority ON schedules(priority);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_deleted_at ON schedules(deleted_at);
CREATE INDEX IF NOT EXISTS idx_reminders_priority ON reminders(priority);
CREATE INDEX IF NOT EXISTS idx_reminders_schedule_id ON reminders(schedule_id);
