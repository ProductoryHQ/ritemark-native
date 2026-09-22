# Sprint 119 fidelity corpus

Paragraph with **bold**, *italic*, ***bold italic***, `inline code`, a [link](https://ritemark.app/en/), and a footnote-ish marker \[1\].

## Heading level 2

### Heading level 3

#### Heading level 4

##### Heading level 5

###### *Heading level 6*

Unordered list:

- First item  
- Second item with **bold**  
  - Nested item  
    - Deeper item  
- Third item

Ordered list:

1. First  
2. Second  
   1. Nested ordered  
   2. Another nested  
3. Third

Mixed list:

1. Ordered parent  
   - Unordered child  
   - Another child

>   
> Blockquote line one. Blockquote line two with `code`.  
>   
> > Nested blockquote.

Code block:

export function publish(doc: string): Promise\<string\> {

  // A comment with \<angle\> & ampersand

  return upload(doc)

}

Indented code block:

plain indented code

second line

Horizontal rule follows.

---

Table:

| Feature | Supported | Notes |
| :---- | :---: | ----: |
| Headings | yes | six levels |
| Tables | yes | alignment row above |
| Images | maybe | depends on the path |

Unicode and emoji: äöüõ ÄÖÜÕ — em dash, ellipsis…, "curly quotes", 'single', 中文, العربية, 🇪🇪 🚀 ✅

Escapes: \*not italic\*, \_not italic\_, a literal backslash \\ and a pipe | inside text.

HTML-ish content that must not execute:  and ![]().

Ritemark standalone comment follows this line.

Line with a trailing hard break at the end.  
Second line after the hard break.

Task list:

- [ ] Unchecked task  
- [x] Checked task

Image, remote:

![Ritemark logo]()

Image, local and missing:

![Missing local image]()

Final paragraph.  
