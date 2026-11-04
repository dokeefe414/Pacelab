"""Operator-only account provisioning with public registration disabled.

Usage after migrations: python -m app.create_user
"""
import getpass
from sqlalchemy.exc import IntegrityError
from .db import SessionLocal
from .models import User
from .schemas import RegisterRequest
from .security import password_hash


def main():
    email = input("Account email: ").strip()
    password = getpass.getpass("Password (12+ characters): ")
    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords do not match")
    data = RegisterRequest(email=email, password=password)
    with SessionLocal() as session:
        session.add(User(email=str(data.email),password_hash=password_hash(data.password)))
        try:
            session.commit()
            print("Account created. Sign in through PaceLab.")
        except IntegrityError as exc:
            session.rollback()
            raise SystemExit("Email already exists") from exc


if __name__ == "__main__":
    main()
