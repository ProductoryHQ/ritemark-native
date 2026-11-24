# Rules engine comparison with Excel

The Experience lead's two Excel-made workbooks were opened with `readWorkbook` and checked with `compileRules` using 24 November 2026. The reference PNGs are in the sibling product directory at `product/design/experience/experiences/excel/fixtures-174/reference/`. Priorities identify the rules within each sheet.

Scale colours are sampled after converting the PNG's embedded display profile to sRGB. A difference of up to two levels per RGB channel counts as a visual match. Bar widths are approximate pixel measurements divided by the 182 px usable width. DXF colours in the Ritemark column are workbook values. The Excel column describes the visible fill and font. The priority and other-cell rows include composition where rules overlap.

| Sheet and priority | Rule | Ritemark computes | Excel render | Result |
| --- | --- | --- | --- | --- |
| Cell value 1 | Greater than 1000 | B2, B4, B6, B8 fill #FFC7CE and font #9C0006 | Pink fill and red text at those cells | Match |
| Cell value 2 | Between 30 and 50 | C3, C4, C6 fill #C6EFCE and font #006100 | Green fill and text at those cells | Match |
| Cell value 3 | Equal to zero | D4 fill #DDEBF7 | Blue fill at D4 | Match |
| Cell value 4 | Outside 4 to 7 | E4, E7:E9 fill #FFEB9C and font #9C5700 | Amber fill and text at those cells | Match |
| Cell value 5 | At least 9 | D3 and D9 bold | Bold at D3 and D9 | Match |
| Cell value 6 | Unequal to A | F3, F5:F6, F8:F9 italic and underlined | Those five codes are italic and underlined | Match |
| Cell value 7 | Below 3 | E9 #C00000 outline | Red outline at E9 | Match |
| Text and blanks 1 | Contains late | A2, A7, A9 fill #FFD966 | Yellow fill at those cells | Match |
| Text and blanks 2 | Begins with Gate | A5 bold | Bold at A5 | Match |
| Text and blanks 3 | Ends with off | A4 strike and font #7F7F7F | Grey struck text at A4 | Match |
| Text and blanks 4 | Blank | A6 fill #FFC7CE and font #9C0006 | Pink blank at A6 | Match |
| Text and blanks 5 | Does not contain Done | B2, B4:B5, B7, B9 fill #FFEB9C and font #9C5700 | Amber fill and text at those cells | Match |
| Text and blanks 6 | Error | C4 and C8 fill #FFC7CE and font #9C0006 | Pink fill and red error text | Match |
| Text and blanks 7 | No error | C2:C3, C5:C7, C9 fill #C6EFCE and font #006100 | Green fill, including blank C3 and C6 | Match |
| Text and blanks 8 | Nonblank | E2:E3, E5:E6, E8:E9 fill #DDEBF7 | Blue fill at the six x entries | Match |
| Top and average 1 | Top three | B4, B8, B10 fill #C6EFCE and font #006100 | Green fill and text at those cells | Match |
| Top and average 2 | Bottom percentage | C6 fill #DDEBF7 | Blue fill at C6 | Match |
| Top and average 3 | Below average | B3, B5, B7, B9, B11, B13 italic and underlined | Italic and underline at those cells, combined with strike on B5 and B13 | Match |
| Top and average 4 | Above average | C3, C5, C7, C10, C12 fill #FFC7CE and font #9C0006 | Pink fill and red text at those cells | Match |
| Top and average 5 | Duplicate | D2:D5, D7, D9, D12 fill #FFEB9C and font #9C5700 | Amber fill and text at those cells | Match |
| Top and average 6 | Unique | D6, D8, D10:D11, D13 bold | Bold at those cells | Match |
| Top and average 7 | Bottom two | B5 and B13 strike and font #7F7F7F | Grey struck text at B5 and B13 | Match |
| Dates 1 | Last seven days | B17:B23 fill #FFD966 | Yellow for 18–24 November inclusive | Match |
| Dates 2 | Yesterday | E22 fill #FFC7CE and font #9C0006 | Pink and red on 23 November | Match |
| Dates 3 | Today | E23 fill #C6EFCE and font #006100 | Green on 24 November | Match |
| Dates 4 | Tomorrow | E24 fill #DDEBF7 | Blue on 25 November | Match |
| Dates 5 | This week | E21:E25 bold | Bold on 22–26 November | Match |
| Dates 6 | Next week | No fill | No next-week dates in view | Match |
| Dates 7 | Last month | No strike | No October dates in view | Match |
| Dates 8 | This month | E2:E25 italic and underlined | All displayed dates in E italic and underlined | Match |
| Scales 1 | Red, yellow, green | B2/B11/B12/B21 #F8696B / #FFE483 / #F7E984 / #63BE7B | #F8696B / #FEE481 / #F8E884 / #63BE7B | Match within RGB tolerance |
| Scales 2 | Median midpoint, fixed max 100 | C2/C11/C12/C21 #FFFFFF / #9DC3E6 / #97BEE2 / #1F4E78 | #FFFFFF / #9DC4E7 / #97BEE2 / #204E78 | Match within RGB tolerance |
| Scales 3 | Mixed values | D2/D4/D21 #FCFCFF / #FCF4F7 / #F8696B with text and blank cells plain | #FCFCFF / #FCF5F8 / #F8696B with text and blank cells plain | Match within RGB tolerance |
| Scales 4 | Includes hidden row 9 | E6/E11/E17 #F5E2AC / #BF8F00 / #E4C874 with E9 computes #D6B249 | #F5E3AC / #BF8F00 / #E4C875 with row 9 hidden | Visible match. Hidden colour cannot be sampled |
| Data bars 1 | Signed gradient | B2/B3/B11/B13 fractions .185/.077/.615/.385 with red negatives and blue positives | About .192/.082/.621/.379 with bars extend either side of the axis | Match within pixel tolerance |
| Data bars 2 | Solid with border | C2/C11 fractions .55/1 with value shown | Green bars about .55/1 with value visible | Match |
| Data bars 3 | Solid bar only | D2/D11 fractions .55/1 with value suppressed | Orange bars about .55/1 with value hidden | Match |
| Other cells 1 | Greater than $B$1 | C4, C6:C7, C10:C11, C13:C14, C17, C19 fill #FFC7CE and font #9C0006 | Pink and red at those cells | Match |
| Other cells 2 | Late status | A:F on rows 4, 7, 10, 14, 17 have #FFD966 except C where the higher-priority red rule wins | Yellow on the five rows with pink in C | Match |
| Other cells 3 | COUNTIF duplicates | E3:E20 bold, including yellow E4 | All driver names bold | Match |
| Priority 1 | Above 40, stop if true | B4:B5, B7, B9, B11 fill #FFC7CE and font #9C0006 with no lower-priority bold | Pink and red at those cells with no bold | Match |
| Priority 2 | Above 10 | B3, B6, B8, B10 fill #C6EFCE and font #006100 after stop-if-true | Green at those four cells | Match |
| Priority 3 | Contains call | C3, C5, C8, C11 fill #FFEB9C and font #9C5700 | Amber at those four cells, combined with bold at C5 | Match |
| Priority 4 | Above 60 | A and C on rows 5, 7, 9 bold with B suppressed | Bold in A and C with regular weight in B | Match |
| Icon sets 1 | Traffic lights | Icon-set metadata, plain B2:B11 | Traffic-light icons at B2:B11 | Mismatch, icons deferred |
| Icon sets 2 | Arrows | Icon-set metadata, plain C2:C11 | Directional arrows at C2:C11 | Mismatch, icons deferred |
| Icon sets 3 | Revenue over 1000 | D2, D4, D6, D8, D10 fill #C6EFCE and font #006100 | Green at those five cells | Match |
| Unreadable formula 1 | INDIRECT | Reported in unreadable with C2:C11 plain | C4:C5, C7, C9, C11 pink and red | Mismatch, INDIRECT unsupported |
| Unreadable formula 2 | Minutes above 40 | B4:B5, B7, B9, B11 fill #C6EFCE and font #006100 | Green at those five cells | Match |
