import express from "express";
import fetch from "node-fetch";

const app = express();
const port = 3000;

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

app.get("/rss-feed", async (req, res) => {
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/FlatFilers/flatfile-plugins/main/plugins/autocast/CHANGELOG.md"
    );
    const changelogMd = await response.text();

    // Split the content to separate the channel title and items
    const [channelTitleMarkdown, ...itemsMarkdown] = changelogMd.split("\n## ");
    const channelTitle = channelTitleMarkdown
      .split("\n")[0]
      .replace("# ", "")
      .trim();

    let rssFeed = '<?xml version="1.0" encoding="UTF-8"?>\n';
    rssFeed += '<rss version="2.0">\n';
    rssFeed += "  <channel>\n";
    rssFeed += `    <title>${channelTitle}</title>\n`;
    rssFeed +=
      "    <link>https://github.com/Flatfilers/flatfile-changelog</link>\n";
    rssFeed += "    <description>Changelog for Flatfile</description>\n";

    itemsMarkdown.forEach((itemMd) => {
      const lines = itemMd.split("\n").filter((line) => line.trim() !== "");
      const title = lines[0].replace("## ", "").trim();
      // Start the description from the second line to exclude the title
      const description = lines.slice(1).join("\n").trim();

      rssFeed += "    <item>\n";
      rssFeed += `      <title>${title}</title>\n`;
      rssFeed += "      <description><![CDATA[";
      rssFeed += description;
      rssFeed += "]]></description>\n";
      rssFeed += "    </item>\n";
    });

    rssFeed += "  </channel>\n";
    rssFeed += "</rss>\n";

    res.header("Content-Type", "application/rss+xml");
    res.send(rssFeed);
  } catch (error) {
    console.error("Error fetching or parsing CHANGELOG.md:", error);
    res.status(500).send("Error generating RSS feed");
  }
});

app.listen(port, () => {
  console.log(`RSS feed available at http://localhost:${port}/rss-feed`);
});
