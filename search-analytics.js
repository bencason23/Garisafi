window.trackMarketplaceSearch = async function trackMarketplaceSearch(market, details) {
  const search = {
    market,
    query: details.query.trim(),
    category: details.category,
    priceRange: details.priceRange
  };
  if (!search.query && !search.category && (!search.priceRange || search.priceRange === "any")) return;
  if (search.priceRange === "any") search.priceRange = "";

  try {
    const response = await fetch("/api/searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(search),
      keepalive: true
    });
    if (!response.ok && response.status !== 204) {
      console.error("Could not record marketplace search:", response.status);
    }
  } catch (error) {
    console.error("Could not record marketplace search:", error);
  }
};
