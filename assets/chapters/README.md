# Chapter Files

Place first-chapter text files in this folder.

## Naming Convention

Name each file after the novel's ID (as defined in `assets/js/main.js`), with a `.txt` extension:

```
novel-slug.txt
```

## Example

If a novel has `id: 'the-iron-crown'` in the NOVELS array, create:

```
assets/chapters/the-iron-crown.txt
```

Then set `chapterFile: 'assets/chapters/the-iron-crown.txt'` on that novel entry in `main.js`.

## Format

Plain text files work best. Paragraph breaks are preserved automatically.
The reader displays text in a scrollable modal with the site's typography.
