#!/usr/bin/env python3
"""Generate the PBKDF2 values for the Netlify admin environment variables."""
import getpass
import hashlib
import secrets

password = getpass.getpass('Create the admin password (at least 14 characters): ')
if len(password) < 14:
    raise SystemExit('Use a password with at least 14 characters.')
confirm = getpass.getpass('Enter it again: ')
if password != confirm:
    raise SystemExit('The passwords did not match.')
salt = secrets.token_bytes(16)
digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 310_000, dklen=32)
print('ADMIN_PASSWORD_SALT=' + salt.hex())
print('ADMIN_PASSWORD_HASH=' + digest.hex())
