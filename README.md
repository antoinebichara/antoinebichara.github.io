# Fairvopia

The cooking blog at [www.fairvopia.com](https://www.fairvopia.com), hosted on GitHub Pages.

The site is built with [Jekyll](https://jekyllrb.com/), which GitHub Pages runs automatically
every time you push. You don't need to install anything to publish.

## How the site is organized

| Where | What it is |
|---|---|
| `_recipes/` | One file per recipe. This is the only place you need to touch to add or edit a recipe. |
| `_layouts/recipe.html` | The shared page around every recipe: the menu bar, header image, footer and comments. Change it once and every recipe updates. |
| `index.html` | The home page. Its recipe list is filled in automatically from `_recipes/`. |
| `about.html`, `contact.html` | The other pages. |
| `img/` | All photos. |
| `_config.yml` | Jekyll settings. |

## Adding a recipe

Create a new file in `_recipes/`, for example `_recipes/moussaka.html`. It will be published at
`www.fairvopia.com/moussaka.html` and appear at the top of the home page. Start the file
with a short header between two `---` lines, then write the recipe:

```
---
title: "Greek Moussaka"
date: 2026-10-17
image: moussaka.jpg
---

<p>
1 eggplant <br>
...
</p>

<img class="img-responsive" src="img/moussaka-2.jpg" alt="">
```

The header fields are:

- `title`: the recipe name, shown on the page and in the browser tab.
- `date`: the date the recipe was posted (year-month-day). The home page is sorted by this.
- `image`: the photo in `img/` used as the big header image.

These fields are optional:

- `list_title`: a different name to show on the home page, if it should differ from `title`.
- `favorite: true`: marks the recipe with a `*` on the home page.
- `hidden: true`: publishes the page but leaves it off the home page.
- `date_note`: extra text after the date, such as `"Updated January 2021"`.

Some older recipes have a time after the date (for example `2016-10-22 15:00:00`). The time
isn't shown anywhere. It only keeps recipes posted on the same day in the right order.

## Previewing locally (optional)

With [Ruby and Jekyll installed](https://jekyllrb.com/docs/installation/), run `jekyll serve`
in this folder and open http://localhost:4000.
