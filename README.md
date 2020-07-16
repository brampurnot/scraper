# scraper

docker build -t bpurnot/scraper .
docker push bpurnot/scraper
cf push scraper --docker-image bpurnot/scraper:latest