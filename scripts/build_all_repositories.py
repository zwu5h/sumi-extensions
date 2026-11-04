"""Generate all providers and the aggregate installation index."""
import argparse
from build_mangadex_repository import build as build_mangadex
from build_web_repositories import build as build_web

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
build_mangadex(args.check)
build_web(args.check)
print("All source repositories verified")
