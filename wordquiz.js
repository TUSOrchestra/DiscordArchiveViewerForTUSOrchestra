// wordquiz.js
// JavaScript部分のみ分離

/**
 * Minimal CSV parser (supports quoted fields and commas/newlines inside quotes).
 */
function parseCsv(text){
    var lines = text.split(/\r\n|\n/);
    var result = [];
    for (var i = 0; i < lines.length; i++){
        var line = lines[i];
        var fields = [];
        var field = "";
        var inQuote = false;
        for (var j = 0; j < line.length; j++){
            var char = line[j];
            if (char === '"'){
                inQuote = !inQuote;
                field += char;
            } else if (char === ',' && !inQuote){
                fields.push(field);
                field = "";
            } else {
                field += char;
            }
        }
        if (field){
            fields.push(field);
        }
        result.push(fields);
    }
    return result;
}

// ...existing code...
// 最後まで
