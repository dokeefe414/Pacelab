"""Store device activity metadata, route samples, and splits.

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("workouts") as batch:
        batch.add_column(sa.Column("start_time", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("source", sa.String(20), nullable=True))
        batch.add_column(sa.Column("source_hash", sa.String(64), nullable=True))
        batch.add_column(sa.Column("avg_heart_rate", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("elevation_gain_meters", sa.Float(), nullable=True))
        batch.add_column(sa.Column("laps_json", sa.JSON(), nullable=True))
        batch.add_column(sa.Column("track_json", sa.JSON(), nullable=True))
    op.create_index("ux_workouts_user_source_hash", "workouts", ["user_id", "source_hash"], unique=True)


def downgrade():
    op.drop_index("ux_workouts_user_source_hash", table_name="workouts")
    with op.batch_alter_table("workouts") as batch:
        batch.drop_column("track_json")
        batch.drop_column("laps_json")
        batch.drop_column("elevation_gain_meters")
        batch.drop_column("avg_heart_rate")
        batch.drop_column("source_hash")
        batch.drop_column("source")
        batch.drop_column("start_time")
