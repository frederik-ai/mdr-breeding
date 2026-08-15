# MDR Breeding

Horse breeding helper app with private CSV import/export.

## Web workflow

The default workflow is now browser-based and private:

1. Open the web app.
2. Upload your existing `horses.csv` file.
3. Use the separate pages to add, view, and rank horses.
4. Download the updated CSV when you are done.

This keeps your horse data on your side without requiring user accounts or a shared backend.

The static web entry point is [`index.html`](index.html), with matching pages for add, view, and best mates. It can be hosted on Cloudflare Pages or any other static host.

## Local legacy files

The old Windows desktop packaging files are archived in [.old](.old). They are kept only for reference and are ignored by the active build.

## Local development

To run the Flask app locally for development:

```bash
python app.py
```

By default the app runs in-memory unless you pass a data path into `create_app(...)` yourself.
