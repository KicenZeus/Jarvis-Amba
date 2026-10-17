-- Inisialisasi Database Jarvis
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    discord_user_id VARCHAR(64) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    timezone VARCHAR(64) DEFAULT 'Asia/Jakarta',
    callsign VARCHAR(64) DEFAULT NULL,
    reminder_style VARCHAR(255) DEFAULT 'santai dan akrab',
    custom_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) DEFAULT 'pending',
    priority VARCHAR(32) DEFAULT 'medium',
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);

CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location VARCHAR(255),
    priority VARCHAR(32) DEFAULT 'MEDIUM',
    status VARCHAR(32) DEFAULT 'SCHEDULED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_schedules_user_time ON schedules(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_schedules_priority ON schedules(priority);

CREATE TABLE IF NOT EXISTS reminders (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    channel_id VARCHAR(64) NOT NULL,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    remind_at TIMESTAMPTZ NOT NULL,
    priority VARCHAR(32) DEFAULT 'MEDIUM',
    status VARCHAR(32) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reminders_status_time ON reminders(status, remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_priority ON reminders(priority);

CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(64) DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notes_user_category ON notes(user_id, category);

CREATE TABLE IF NOT EXISTS financial_transactions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    kind VARCHAR(16) NOT NULL, -- 'income' atau 'expense'
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(16) DEFAULT 'IDR',
    category VARCHAR(64) DEFAULT 'general',
    description TEXT,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_user_date ON financial_transactions(user_id, occurred_at);

CREATE TABLE IF NOT EXISTS task_chains (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_type VARCHAR(20) NOT NULL DEFAULT 'DISCORD',
    channel_id VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'MULTI_STEP_TASK',
    proposed_plan JSONB NOT NULL DEFAULT '{"actions":[]}'::jsonb,
    execution_result JSONB NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL',
    revision_notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_task_chains_user_status ON task_chains(user_id, status);
CREATE INDEX IF NOT EXISTS idx_task_chains_created ON task_chains(created_at DESC);
