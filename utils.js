module.exports = {
  // Cuts a string into a smaller string at a place that makes sense.
  // Returns an empty string if no satisfactory cut was found.
  sensibleCut: function(body, minSize, maxSize)
  {
    // Trim junk from the start of the string
    body = body.replace(/^[^a-z0-9(@"']+/im, '');

    const endRegex = /[.:]( |$)/gi;
    while (result = endRegex.exec(body)) {
      if (result.index >= maxSize)
        break;
      if (result.index >= minSize)
        return body.substring(0, result.index + result[0].length).trim();
    }

    return "";
  },

  prettyJoin: function(array, delimiter, finalDelimiter)
  {
    return [array.slice(0, -1).join(delimiter), array.slice(-1)[0]].join(array.length < 2 ? '' : finalDelimiter);
  }
} 