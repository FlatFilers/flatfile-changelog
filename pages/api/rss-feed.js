import fetch from "node-fetch";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000"; // Set BASE_URL in your environment variables

export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/FlatFilers/flatfile-plugins/main/plugins/autocast/CHANGELOG.md"
    );
    const changelogMd = await response.text();

    // // Process Markdown to HTML (or any required format)
    // const htmlContent = simpleMarkdownToHtml(changelogMd);

    // Your logic to create the RSS feed
    let rssFeed = createRssFeed(changelogMd, req);

    res.setHeader("Content-Type", "application/rss+xml");
    res.status(200).send(rssFeed);
  } catch (error) {
    console.error("Error fetching or parsing CHANGELOG.md:", error);
    res.status(500).send("Error generating RSS feed");
  }
}

// The simpleMarkdownToHtml function as you have it, which converts Markdown to HTML
function simpleMarkdownToHtml(markdown) {
  let htmlContent = markdown
    // Remove commit number patterns
    .replace(/\b[0-9a-f]{7}:\s/gim, "")
    // Headers, blockquotes, and other formatting
    .replace(
      /^## (.*$)/gim,
      "<h2 id='version_$1'><a href='#version_$1'>$1</a></h2>"
    )
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>")
    .replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*)\*/gim, "<em>$1</em>")
    .replace(/!\[(.*?)\]\((.*?)\)/gim, "<img alt='$1' src='$2'>")
    .replace(/\[(.*?)\]\((.*?)\)/gim, "<a href='$2'>$1</a>")
    .split("\n");

  // Process lists
  let inList = false;
  let listLevel = 0;
  for (let i = 0; i < htmlContent.length; i++) {
    const line = htmlContent[i];
    const trimmedLine = line.trim();
    const currentLevel = line.indexOf(trimmedLine) / 2; // Assuming 2 spaces for indentation

    if (/^- /.test(trimmedLine)) {
      if (!inList) {
        inList = true;
        listLevel = currentLevel;
        if (trimmedLine.includes("Updated dependencies")) {
          htmlContent[i] = "<strong>Updated dependencies</strong>";
        } else {
          htmlContent[i] = "<ul><li>" + trimmedLine.substring(2) + "</li>";
        }
      } else {
        if (trimmedLine.includes("Updated dependencies")) {
          htmlContent[i] = "<strong>Updated dependencies</strong>";
          htmlContent[i - 1] += "</li></ul>".repeat(listLevel + 1);
          inList = false;
          listLevel = 0;
        } else {
          htmlContent[i] = "<li>" + trimmedLine.substring(2) + "</li>";
        }
      }
    } else {
      if (inList) {
        htmlContent[i - 1] += "</li></ul>".repeat(listLevel + 1);
        inList = false;
        listLevel = 0;
      }
    }
  }
  if (inList) {
    htmlContent[htmlContent.length - 1] += "</li></ul>".repeat(listLevel + 1);
  }

  return htmlContent.join("\n");
}

// Function to create RSS feed from HTML content
function createRssFeed(htmlContent, req) {
  const { headers } = req; // Get the request headers
  const protocol = headers["x-forwarded-proto"] || req.protocol || "http"; // Check for forwarded protocol
  const host = headers.host;
  const baseUrl = `${protocol}://${host}`;

  // Split the content to separate the channel title and items
  const [channelTitleMarkdown, ...itemsMarkdown] = htmlContent.split("\n## ");
  const channelTitle = channelTitleMarkdown
    .split("\n")[0]
    .replace("# ", "")
    .trim();

  let rssFeed = '<?xml version="1.0" encoding="UTF-8"?>\n';
  rssFeed += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'; // Add Atom namespace
  rssFeed += "  <channel>\n";
  rssFeed += `    <title>${channelTitle}</title>\n`;
  rssFeed += `    <link>https://github.com/Flatfilers/flatfile-changelog</link>\n`;
  rssFeed += `    <atom:link href="${baseUrl}/api/rss-feed" rel="self" type="application/rss+xml" />\n`; // Self-referencing link
  rssFeed += "    <description>Changelog for Flatfile</description>\n";

  itemsMarkdown.forEach((itemMd, index) => {
    const lines = itemMd.split("\n").filter((line) => line.trim() !== "");
    const title = lines[0].replace("## ", "").trim();
    const description = lines.join("\n").trim();

    rssFeed += "    <item>\n";
    rssFeed += `      <title>${title}</title>\n`;
    rssFeed += `      <guid>${baseUrl}/api/rss-feed/${index}</guid>\n`; // Example GUID
    rssFeed += "      <description><![CDATA[";
    rssFeed += description;
    rssFeed += "]]></description>\n";
    rssFeed += "    </item>\n";
  });

  rssFeed += "  </channel>\n";
  rssFeed += "</rss>\n";

  return rssFeed;
}
