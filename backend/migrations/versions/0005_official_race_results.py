"""Store reviewed official results separately from watch measurements."""
from alembic import op
import sqlalchemy as sa
revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("workouts") as batch:
        batch.add_column(sa.Column("race_result", sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table("workouts") as batch:
        batch.drop_column("race_result")
