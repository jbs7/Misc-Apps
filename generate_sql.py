import json

json_path = "mizo_kjv_bible.json"
sql_path = "insert_contents.sql"

print("Loading Bible JSON...")
with open(json_path, 'r', encoding='utf-8') as f:
    bible_data = json.load(f)

print("Generating SQL file...")
with open(sql_path, 'w', encoding='utf-8') as sql_file:
    # Set search_path or write transaction
    sql_file.write("BEGIN;\n\n")
    sql_file.write("-- Clear any existing contents for these book_ids if needed\n")
    sql_file.write("-- DELETE FROM bible.contents WHERE book_id BETWEEN 206 AND 271;\n\n")
    
    # We will batch insertions to avoid massive single statement limits
    batch_size = 1000
    values_batch = []
    
    total_inserted = 0
    
    # Iterate through books in order
    for book_num in range(1, 67):
        book_num_str = str(book_num)
        if book_num_str not in bible_data:
            continue
            
        book_entry = bible_data[book_num_str]
        fields = book_entry.get('fields', {})
        book_name = fields.get('name', {}).get('stringValue', '')
        
        # book_id mapping: book_num 1 maps to 206, 2 to 207, etc.
        book_id = 205 + book_num
        
        chapters = fields.get('chapters', {}).get('arrayValue', {}).get('values', [])
        for ch_val in chapters:
            ch_fields = ch_val.get('mapValue', {}).get('fields', {})
            ch_num = int(ch_fields.get('number', {}).get('integerValue') or ch_fields.get('number', {}).get('stringValue'))
            
            verses = ch_fields.get('verses', {}).get('arrayValue', {}).get('values', [])
            for v_val in verses:
                v_fields = v_val.get('mapValue', {}).get('fields', {})
                v_num = int(v_fields.get('number', {}).get('integerValue') or v_fields.get('number', {}).get('stringValue'))
                v_content = v_fields.get('content', {}).get('stringValue', '')
                
                # Escape single quotes for SQL
                escaped_content = v_content.replace("'", "''")
                
                values_batch.append(f"({book_id}, {ch_num}, {v_num}, '{escaped_content}')")
                total_inserted += 1
                
                if len(values_batch) >= batch_size:
                    sql_file.write("INSERT INTO bible.contents (book_id, chapter, verse, verse_content) VALUES\n")
                    sql_file.write(",\n".join(values_batch))
                    sql_file.write(";\n\n")
                    values_batch = []
                    
    # Write remaining values in the last batch
    if values_batch:
        sql_file.write("INSERT INTO bible.contents (book_id, chapter, verse, verse_content) VALUES\n")
        sql_file.write(",\n".join(values_batch))
        sql_file.write(";\n\n")
        
    sql_file.write("COMMIT;\n")

print(f"SQL generation complete! Wrote {total_inserted} insert statements to '{sql_path}'.")
