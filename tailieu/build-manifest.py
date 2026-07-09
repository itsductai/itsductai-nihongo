#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sinh lại tailieu/manifest-thin.json — CHẠY LẠI FILE NÀY mỗi khi thêm/sửa/xóa
bộ từ vựng trong thư mục tailieu/, để app tải nhanh (lazy loading 2 tầng).

Cách chạy: cd tailieu/ && python3 build-manifest.py

Manifest chỉ chứa field NHẸ (_id/kanji/cautruc/doc/nghia) — đủ cho Dashboard,
tìm kiếm toàn cục, auto-scan đọc báo. Field NẶNG (vi_du, dong_nghia,
trai_nghia, doc_marked, vi_du_ruby, han_viet) CHỈ tải khi thực sự mở bộ ra
học (xem ensureDeckLoaded() trong js/loader-nav.js).
"""
import json, glob

def main():
    manifest = {"decks": []}
    skip = {"index.json", "grammar-groups.json", "manifest-thin.json"}

    for f in sorted(glob.glob("*.json")):
        if f in skip:
            continue
        d = json.load(open(f, encoding="utf-8"))
        if "words" not in d:
            continue
        deck_id = f.replace(".json", "")

        seen_ids = {}
        thin_words = []
        for i, w in enumerate(d["words"]):
            key = w.get("kanji") or w.get("cautruc") or f"item{i}"
            base_id = f"{deck_id}::{key}"
            if base_id in seen_ids:
                seen_ids[base_id] += 1
                base_id = f"{base_id}#{seen_ids[base_id]}"
            else:
                seen_ids[base_id] = 0
            thin_words.append({
                "_id": base_id,
                "kanji": w.get("kanji"),
                "cautruc": w.get("cautruc"),
                "doc": w.get("doc"),
                "nghia": w.get("nghia"),
            })

        manifest["decks"].append({
            "id": deck_id,
            "title": d.get("title", f),
            "type": "NGUPHAP" if d.get("type") == "NGUPHAP" else "TUVUNG",
            "series": d.get("series"),
            "level": d.get("level"),
            "private": d.get("private", False),
            "words": thin_words,
        })

    out = json.dumps(manifest, ensure_ascii=False)
    with open("manifest-thin.json", "w", encoding="utf-8") as f:
        f.write(out)
    print(f"Đã sinh manifest-thin.json — {len(manifest['decks'])} bộ, {round(len(out.encode('utf-8'))/1024, 1)} KB")

if __name__ == "__main__":
    main()
