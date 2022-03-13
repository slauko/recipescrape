import * as cheerio from 'cheerio';
import fetch from 'node-fetch'
import * as fs from "fs";

// let value = "200"
// let amount  = value.split(" ")[0];
// let unit    = value.split(" ")[1];

// fs.readFile("recipes.json", "utf8", (err, data) =>{
//   let recipes = JSON.parse(data);
//   console.log(recipes)
// })

async function getRecipeURLs() {
  let urls = [];
  let fetches = [];
  const maxPages = 9;
  for (let currentPage = 0; currentPage < maxPages; currentPage++) {
    let currentPageURL = `https://www.chefkoch.de/rs/s${currentPage}t21r3/Hauptspeise-Rezepte.html`;
    fetches.push(fetch(currentPageURL).then(res => res.text()).then(html => {
      const page  = cheerio.load(html)
      page(".ds-recipe-card").find("a").each((_ , element)=>{
        urls[urls.length] = page(element).attr("href").split("#")[0];
      });
    }));
  }

  return await Promise.all(fetches).then(() => {
    return urls
  })
};
let pages = await getRecipeURLs();
let counter = 0;
async function getRecipefromURL(url) { 
  return fetch(url).then(res => res.text()).then(html => {
    const recipe = cheerio.load(html)
    const recipeDescription = recipe(".recipe-text")?.text().replace(/[^a-zA-Z0-9À-ž./\- ]/g, '').trim();

    const recipeTitle       = recipe("h1").text();
    const recipePicture     = recipe(".bi-recipe-slider-open amp-img").find("img").attr("src").replace("360x240", "600x400");
    const recipeRating      = recipe(".ds-rating-avg strong").text()
    const recipeIngredients_units = [];
    const recipeIngredients_names = [];
    recipe(".ingredients").find(".td-left").each((index, entry) => {
      recipeIngredients_units[index] = recipe(entry).text().replaceAll(/\s+/g,' ').trim();
    });
    recipe(".ingredients").find(".td-right").each((index, entry) => {
      recipeIngredients_names[index] = recipe(entry).text().replaceAll(/\s+/g,' ').trim(); 
    });
    const recipeIngredients = [];
    recipeIngredients_units.forEach((value, index) => {
      const amount  = value.split(" ")[0];
      const unit    = value.split(" ")[1];
      recipeIngredients[index] = {
        amount: amount,
        unit: unit,
        name: recipeIngredients_names[index]
      }
    });
    const recipePreparation = recipe(".rds-recipe-meta+ .ds-box").html();
    const recipeTags = [];
    recipe(".rds-recipe-meta").find("span").each((index, element) =>{
      recipeTags[index] = recipe(element).text().replaceAll(/\s+/g,' ').replace(/[^a-zA-ZÀ-ž0-9./\- ]/g, '').trim();
    });

    ++counter;

    console.log(`Scraped ${counter} / ${pages.length} recipes!`);
    return {
      title: recipeTitle,
      picture: recipePicture,
      rating: recipeRating,
      ingredients: recipeIngredients,
      description: recipeDescription,
      preparation: recipePreparation,
      tags: recipeTags
    }
  });
};

let promisedRecipes = [];
pages.forEach(value => {
  promisedRecipes.push(getRecipefromURL(value));
});

Promise.all(promisedRecipes).then(scrapedRecipes =>{
  fs.writeFile("recipes.json", JSON.stringify(scrapedRecipes), "utf8", ()=>{});
})