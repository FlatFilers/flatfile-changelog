import fetch from "node-fetch";
import { parse } from "url"; // Import URLSearchParams to parse query parameters

export default async function handler(req, res) {
  try {
    const { query } = parse(req.url, true); // Parse query parameters
    const githubRepo = query.repo; // Get the 'repo' parameter from the query

    if (!githubRepo) {
      // Check if 'repo' parameter is missing
      res.status(400).send("Missing 'repo' parameter");
      return;
    }

    const githubUrl = `https://raw.githubusercontent.com/Flatfilers/${githubRepo}/CHANGELOG.md`;
    const response = await fetch(githubUrl);
    const changelogMd = await response.text();

    // Your logic to create the RSS feed
    let rssFeed = createRssFeed(changelogMd, req);

    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow all origins (for testing)
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
    .replace(/^## (.*$)/gim, "<strong>$1: </strong>\n")
    .replace(/^### (.*$)/gim, "<strong>$1: </strong>\n")
    .replace(/^# (.*$)/gim, "")
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

  const { query } = parse(req.url, true); // Parse query parameters
  const githubRepo = query.repo; // Get the 'repo' parameter from the query

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
  rssFeed += `    <atom:link href="${baseUrl}/api/feed" rel="self" type="application/rss+xml" />\n`; // Self-referencing link
  rssFeed += `    <description>Keep track of every change to ${channelTitle}.</description>\n`;
  rssFeed += `    <image>`;
  rssFeed += `      <url>https://mma.prnewswire.com/media/2152240/flatfile_logo_Logo.jpg</url>`;
  rssFeed += `      <title>${channelTitle}</title>`;
  rssFeed += `      <link>https://www.flatfile.com</link>`;
  rssFeed += `    </image>`;

  itemsMarkdown.forEach((itemMd, index) => {
    const lines = itemMd.split("\n").filter((line) => line.trim() !== "");
    const title = lines[0].replace(/^(?<!#)##\s/, "").trim();
    const dateStr = lines[1].replace(/^(?<!#)####\s/, "").trim();
    const dateObj = new Date(dateStr);
    const date = dateObj.toUTCString();
    const description = lines.slice(2).join("\n").trim();

    rssFeed += "    <item>\n";
    rssFeed += `      <title>Version ${title}</title>\n`;
    rssFeed += `      <pubDate>${date}</pubDate>\n`;
    rssFeed += `      <enclosure url="https://mma.prnewswire.com/media/2152240/flatfile_logo_Logo.jpg" type="image/jpeg" />`;
    rssFeed += `      <link>${baseUrl}/api/feed/?repo=${githubRepo}</link>\n`;
    rssFeed += `      <guid>${githubRepo}_${title}</guid>\n`;
    rssFeed += "      <description><![CDATA[";

    rssFeed += simpleMarkdownToHtml(description);
    rssFeed += `]]></description>\n`;
    rssFeed += "    </item>\n";
  });

  rssFeed += "  </channel>\n";
  rssFeed += "</rss>\n";

  return rssFeed;
}
