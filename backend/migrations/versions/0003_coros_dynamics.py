"""Preserve COROS timer-vs-elapsed and running dynamics.

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("workouts") as batch:
        batch.add_column(sa.Column("elapsed_seconds",sa.Integer(),nullable=True))
        batch.add_column(sa.Column("elevation_loss_meters",sa.Float(),nullable=True))
        batch.add_column(sa.Column("max_heart_rate",sa.Integer(),nullable=True))
        batch.add_column(sa.Column("avg_cadence_spm",sa.Float(),nullable=True))
        batch.add_column(sa.Column("avg_power_watts",sa.Float(),nullable=True))


def downgrade():
    with op.batch_alter_table("workouts") as batch:
        for column in ("avg_power_watts","avg_cadence_spm","max_heart_rate",
                       "elevation_loss_meters","elapsed_seconds"):
            batch.drop_column(column)
