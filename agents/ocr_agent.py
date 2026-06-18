"""OCR Agent — Tesseract reading for books, sign boards, labels, invoices."""
try:
    import pytesseract
    from PIL import Image
    _OK = True
except Exception:
    _OK = False

LANG_PACKS = "eng+guj+hin+tam+tel+mar+ben+urd"


def read_text(image_path: str, langs: str = LANG_PACKS) -> str:
    if not _OK:
        raise RuntimeError("Install OCR deps: pip install pytesseract pillow "
                           "(plus the tesseract binary + language packs)")
    try:
        return pytesseract.image_to_string(Image.open(image_path), lang=langs).strip()
    except pytesseract.TesseractError:
        return pytesseract.image_to_string(Image.open(image_path), lang="eng").strip()
