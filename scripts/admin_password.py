#!/usr/bin/env python3
"""Reset the ngano admin password without signing in.

Normally you change the password from the dashboard. This is the way back in when you
cannot: it hashes a password exactly the way the Worker does and writes the KV record.

    python3 scripts/admin_password.py --username ishe
    npx wrangler kv key put --namespace-id <ADMIN id> admin:user --path admin-user.json

The hashing has to match `worker/src/admin/auth.ts` exactly. Workers refuses a single
PBKDF2 `deriveBits` above 100,000 iterations, so both sides run the work as chained
rounds of that size, each round's output seeding the next.
"""

from __future__ import annotations

import argparse
import datetime
import getpass
import hashlib
import json
import os
import secrets
import sys

ITERATIONS = 600_000
MAX_PER_CALL = 100_000
SALT_BYTES = 16
KEY_BYTES = 32

WORDS = [
    "shona", "ngano", "catalogue", "harare", "corpus", "mbira", "zambezi", "granite",
    "chimurenga", "matopos", "sable", "msasa", "kopje", "baobab", "nyanga", "limpopo",
]


def derive(password: str, salt: bytes, iterations: int = ITERATIONS) -> bytes:
    """PBKDF2-HMAC-SHA256 in chained rounds, mirroring the Worker."""
    material = password.encode()
    remaining = iterations
    while remaining > 0:
        rounds = min(MAX_PER_CALL, remaining)
        material = hashlib.pbkdf2_hmac("sha256", material, salt, rounds, dklen=KEY_BYTES)
        remaining -= rounds
    return material


def suggest() -> str:
    return "-".join(secrets.choice(WORDS) for _ in range(4)) + "-" + str(secrets.randbelow(9000) + 1000)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--username", default="ishe")
    ap.add_argument("--out", default="admin-user.json", help="where to write the KV record")
    ap.add_argument("--print-password", action="store_true", help="echo the generated password")
    args = ap.parse_args()

    password = getpass.getpass("New password (blank to generate one): ")
    generated = False
    if not password:
        password = suggest()
        generated = True
    elif len(password) < 12:
        sys.exit("Use at least twelve characters. Length is the rule, not character classes.")
    else:
        again = getpass.getpass("Again: ")
        if again != password:
            sys.exit("Those did not match.")

    salt = os.urandom(SALT_BYTES)
    record = {
        "username": args.username,
        "salt": salt.hex(),
        "hash": derive(password, salt).hex(),
        "iterations": ITERATIONS,
        "updated": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    with open(args.out, "w") as f:
        json.dump(record, f)

    print(f"\nWrote {args.out} for user {args.username!r}.")
    if generated or args.print_password:
        print(f"Password: {password}")
        print("Write it down now. It is not stored anywhere and cannot be recovered.")
    print("\nInstall it with:")
    print(f"  npx wrangler kv key put --namespace-id <ADMIN id> admin:user --path {args.out}")
    print("\nThen delete the file. Every existing session keeps working until it expires,")
    print("so sign in and out once if you are locking someone out rather than yourself.")


if __name__ == "__main__":
    main()
