'use strict';

const express = require('express'),
      http = require('http'),
      puppeteer = require('puppeteer'),
      devices = require('puppeteer/DeviceDescriptors'),
      iphone = devices['iPhone 6'],
      FuzzySet = require('fuzzyset.js');

      
      var marketplaces = [
          { 
            name: 'amazon',
            defaultCurrency: 'USD',
            domain: 'https://www.amazon.com/s/?field-keywords=',
            resultItem: '.s-result-item',
            productName: 'span.a-size-base',
            productURL: '.a-link-normal.a-text-normal',
            productImage: 'img',
            productCurrency: 'span.a-price span.a-price-symbol',
            productPrice: '.a-offscreen',
            productCurrency: undefined        
        },
        {
            name: 'coolblue',
            defaultCurrency: 'EUR',
            domain: 'https://www.coolblue.be/nl/zoeken?query=',
            resultItem: '.product-grid__card',
            productName: '.product-card__title h3.text-color--link',
            productURL: '.product-card__title a.link',
            productImage: 'img',
            productCurrency: '.sales-price__current',
            productPrice: '.sales-price__current',
            productCurrency: ''
        },
        {
            name: 'grainger',
            defaultCurrency: 'USD',
            domain: 'https://www.grainger.com/search?searchBar=true&ts_optout=true&searchQuery=',
            resultItem: '.result.clear.reactive ',
            productName: '.productName .ui-link',
            productURL: '.pidp-link',
            productImage: '.aggregatedResultImage',
            productPrice: '.price',
            productCurrency: ''
        },
        {
            name: 'msc',
            defaultCurrency: 'USD',
            domain: 'https://www.mscdirect.com/browse/lookahead/?hdrsrh=true&searchterm=',
            resultItem: '.result.clear.reactive ',
            productName: '.productName .ui-link',
            productURL: '.pidp-link',
            productImage: '.image.left',
            productPrice: '.price',
            productCurrency: ''
        },
        {
            name: 'alibaba',
            defaultCurrency: 'USD',
            domain: 'https://m.alibaba.com/trade/search?SearchText=',
            resultItem: '.product-item',
            productName: '.product-title',
            productURL: '.product-detail',
            productImage: 'img',
            productPrice: '.product-price',
            productCurrency: 'USD'
        },
        {
            name: 'shi',
            defaultCurrency: 'USD',
            domain: 'https://punchout.shi.com/shop/search?k=',
            resultItem: '.srProduct',
            productName: '.srh_pr.pnm',
            productURL: '.srh_pr.pnm',
            productImage: 'img.productPhoto',
            productPrice: 'price-range',
            productCurrency: 'USD'        
        }
     ]

// App
const app = express();
app.set('port', 8080);
app.get('/scrapeProducts/:marketplace', async (req, res) => {
    let product = req.query.product
    let marketPlace = req.params.marketplace

    console.log("What is the marketplace: " + marketPlace)
    console.log("What is the product: " + product)

    let browser = undefined
    let page = undefined

    if((product != undefined) && (marketPlace != undefined))   {
        try   {
            let SELECTORS = marketplaces.find(el => el.name.toUpperCase() === marketPlace.toUpperCase())
            browser = await puppeteer.launch(
                {
                    headless: true,
                    defaultViewport: {
                        width: 360, //1240
                        height: 640 //820
                    },
                    args: [
                        '--ignore-certificate-errors',
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--window-size=360,640',
                        "--disable-accelerated-2d-canvas",
                        "--disable-gpu",
                        '--disable-dev-shm-usage'
                    ]
                }
            )
            page = await browser.newPage();
            page.on('error', msg => {
                console.log('Got an errror.....')
                throw msg ;
            });

            // Configure the navigation timeout
            await page.setDefaultNavigationTimeout(0);
            await page.emulate(devices['devicesMap']['iPhone 6'])
            //await page.emulate(iphone)
            await page.goto(`${SELECTORS.domain}${product}!`, {timeout: 90000})

            let products = [];
            const els = await page.$$(SELECTORS.resultItem);
            console.log("Got some results: " + els.length)

            for (const result of els) {
                try {
                    //First one is price > if not price is found, an exception is thrown and nothing is added to the array
                    var prodPrice = await result.$eval(SELECTORS.productPrice, el => el.textContent);

                    //Specific to Grainger > check if it is not a range
                    if(prodPrice.includes('-'))   {
                        let tempPrice = prodPrice.replace(/\s+/g, '')
                        let split = tempPrice.split('-')
                        console.log('What is the split: ' + JSON.stringify(split))
                        prodPrice = split[0].replace(",", ".") //Specifically for alibaba
                        console.log('This is the prod price: ' + prodPrice)
                    }

                    const productName = await result.$eval(SELECTORS.productName, el => el.textContent);
                    console.log("Got a product name: " + productName)

                    let productImage = '';
                    let productUrl = '';
                    let currency = SELECTORS.defaultCurrency;
                    console.log("Got a currency: " + currency)

                    try {
                        productImage = await result.$eval(SELECTORS.productImage, el => el.src);
                        console.log("Got an image: " + productImage)
                        productUrl = await result.$eval(SELECTORS.productURL, el => el.href);
                        console.log("Got a URL: " + productUrl)
                        currency = await result.$eval(SELECTORS.productCurrency, el => el.textContent);
                        console.log('What is the currency: ' + currency);
                    }catch(error) {
                        console.log('No currency')
                    }
                    
                    let product = {
                        name: productName,
                        price:  Number(prodPrice.replace(/[^0-9\.]+/g,"")),
                        image: productImage,
                        url: productUrl,
                        currency: currency,
                        marketplace: SELECTORS.name
                    }

                    console.log("Adding the product: " + JSON.stringify(product))
    
                    products.push(product);
                }catch(error)   {
                    console.log('Nothing found...')
                }
            
                //
                //console.log(`Image source "${imgSrc}".`)
            }

            console.log("What are the products: " + JSON.stringify(products))

            //await browser.close()


            /*await page.goto(SELECTORS.domain, {
                timeout: 3000000
            });*/
            //await page.goto(SELECTORS.domain, {waitUntil: 'networkidle2'});

            //Accept the popup
            //await page.click('.js-confirm-button');

            // search and wait the product list
            //await page.type(SELECTORS.searchBox, product);
            /*await page.waitForSelector(SELECTORS.searchBox, { visible: true }); 
            await page.$eval(SELECTORS.searchBox, el => el.value = 'kut');
            await page.$eval(SELECTORS.searchBox, (el, value) => el.value = value, product);
            await page.click(SELECTORS.searchButton);
            const response = await page.waitForSelector(SELECTORS.waitFor, {visible: true, timeout: 3000 })

            const products = await page.evaluate((SELECTORS) => {
                const links = Array.from(document.querySelectorAll(SELECTORS.resultItem));
                return links.map(link => {
                    if (link.querySelector(SELECTORS.wholePrice)) {
                        return {
                            name: link.querySelector(SELECTORS.productName).textContent,
                            url: link.querySelector(SELECTORS.productURL).href,
                            image: link.querySelector(SELECTORS.productImage).src,
                            currency: link.querySelector(SELECTORS.productCurrency).textContent,
                            price: parseFloat(link.querySelector(SELECTORS.productPrice).textContent.replace(/[,.]/g, m => (m === ',' ? '.' : '')))
                        };
                    }
                });
            }, SELECTORS);*/

            let fSet = FuzzySet();
            for(let prod of products)    {
                if(prod != null)    {
                    fSet.add(prod.name);
                }
            }
                    
            let result = fSet.get(product, products, 0)

            //Take the first 5 products
            let index = 0;
            let fProducts = [];
            for(let res of result)  {
                if(index < 5)   {
                    let nProd = products.find(el => el.name == res[1]);
                    fProducts.push(nProd);
                }

                index++;
            }

            console.log("Final products: " + JSON.stringify(fProducts))
            res.send({ response : 'OK', products: fProducts })
        }catch (error) {
            // display errors
            console.log("Got an error:  " + error.message)
            res.send({ response : 'KO', error: JSON.stringify(error) });
        }finally{
            //Close the pages
            //var pages = await browser.pages();
            //pages.forEach((page) => page.close());

            browser.close();
        }
    }else   {
        res.status(500).send('Missing "product" and/or "marketplace" query parameter')
    }
});

//Start the server
http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
});
