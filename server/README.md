# Project Setup

This project uses [uv](https://docs.astral.sh/uv/) to manage its Python version and dependencies, so everyone works with identical package versions regardless of their global Python.

## Setup

**1. Create and activate the environment**

```bash
python -m venv .venv

source .venv/bin/activate        # macOS/Linux
.venv\Scripts\activate           # Windows
```

**2. Install uv**

```bash
pip install uv
```

**3. Install dependencies**

```bash
uv sync --active
```

You're now ready to work.

## Running the project

```bash
python main.py
```

Run `deactivate` when you're done.

## Installing a new package

Use `uv add` (not `pip install`) so it's recorded for everyone:

```bash
uv add <package-name>
```

Then commit and push the updated files:

```bash
git add pyproject.toml uv.lock
git commit -m "Add <package-name>"
git push
```

## Keeping in sync

When someone adds a package, pull and re-sync:

```bash
git pull
uv sync --active
```