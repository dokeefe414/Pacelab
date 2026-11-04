"""Revokeable JWT sessions using account token generation.

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("token_version", sa.Integer(), nullable=False,
                                   server_default=sa.text("0")))


def downgrade():
    with op.batch_alter_table("users") as batch:
        batch.drop_column("token_version")
