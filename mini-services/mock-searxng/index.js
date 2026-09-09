/**
 * Mock SearXNG server (mini-service).
 *
 * A tiny stand-in for the real SearXNG instance, used for end-to-end
 * verification in the sandbox. Returns a fixed JSON payload for any
 * /search?format=json request. Listens on port 8080.
 *
 * In production this is replaced by the real SearXNG container (see
 * docker/searxng.docker-compose.yml).
 */
const http = require("node:http");

const RESULTS = [
  {
    url: "https://www.kernel.org/",
    title: "The Linux Kernel Archives",
    content:
      "The Linux Kernel Archives is the primary site for the Linux kernel source. Download the latest stable release, read documentation, and learn about kernel development.",
    engine: "duckduckgo",
    category: "general",
  },
  {
    url: "https://en.wikipedia.org/wiki/Linux_kernel",
    title: "Linux kernel - Wikipedia",
    content:
      "The Linux kernel is a free and open-source, monolithic, modular, multitasking, Unix-like operating system kernel. It was conceived and created in 1991 by Linus Torvalds.",
    engine: "bing",
    category: "general",
  },
  {
    url: "https://github.com/torvalds/linux",
    title: "torvalds/linux - Linux kernel source tree - GitHub",
    content:
      "Linux kernel source tree. Contribute to torvalds/linux development by creating an account on GitHub.",
    engine: "google",
    category: "general",
  },
  {
    url: "https://www.linux.com/",
    title: "Linux.com - News For Open Source Professionals",
    content:
      "The latest Linux and open source news, tutorials, and information for IT professionals.",
    engine: "duckduckgo",
    category: "general",
  },
  {
    url: "https://kernelnewbies.org/",
    title: "Linux Kernel Newbies",
    content:
      "Resources for learning about the Linux kernel. Includes a glossary, FAQ, and links to documentation.",
    engine: "brave",
    category: "general",
  },
  {
    url: "https://www.linux.org/",
    title: "Linux.org - Community for Linux Users",
    content:
      "A community forum and resource site for Linux users of all experience levels. Includes tutorials, forums, and documentation.",
    engine: "duckduckgo",
    category: "general",
  },
  {
    url: "https://lwn.net/",
    title: "LWN.net - Linux Weekly News",
    content:
      "LWN.net is a reader-supported news site dedicated to producing free, high-quality coverage of the Linux and free software communities.",
    engine: "bing",
    category: "general",
  },
  {
    url: "https://www.phoronix.com/",
    title: "Phoronix - Linux Hardware Reviews & Benchmarks",
    content:
      "Phoronix is the leading technology website for Linux hardware reviews, open-source news, and benchmarking.",
    engine: "google",
    category: "general",
  },
  {
    url: "https://linuxfoundation.org/",
    title: "The Linux Foundation",
    content:
      "The Linux Foundation is a non-profit consortium dedicated to fostering the growth of Linux and collaborative development.",
    engine: "brave",
    category: "general",
  },
  {
    url: "https://archlinux.org/",
    title: "Arch Linux",
    content:
      "A lightweight and flexible Linux distribution that tries to keep it simple. Rolling release model with bleeding-edge packages.",
    engine: "duckduckgo",
    category: "general",
  },
  {
    url: "https://www.debian.org/",
    title: "Debian - The Universal Operating System",
    content:
      "Debian is a free operating system, known for its strict adherence to free software principles and stability.",
    engine: "bing",
    category: "general",
  },
  {
    url: "https://www.ubuntu.com/",
    title: "Ubuntu - The Leading OS for PC, Cloud and IoT",
    content:
      "Ubuntu is an open-source software platform that runs everywhere from the PC, to the server, to the cloud and all things connected.",
    engine: "google",
    category: "general",
  },
  {
    url: "https://news.ycombinator.com/item?id=12345",
    title: "Ask HN: Best resources for learning the Linux kernel?",
    content:
      "A Hacker News thread discussing books, courses, and online resources for understanding the Linux kernel internals.",
    engine: "google news",
    category: "news",
  },
  {
    url: "https://www.youtube.com/watch?v=linuxkernel",
    title: "Linux Kernel Development - YouTube",
    content:
      "A video walkthrough of the Linux kernel source tree and development workflow.",
    engine: "youtube",
    category: "videos",
  },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname !== "/search") {
    res.writeHead(404);
    res.end();
    return;
  }
  if (url.searchParams.get("format") !== "json") {
    res.writeHead(400);
    res.end();
    return;
  }
  const q = url.searchParams.get("q") || "";
  const category = url.searchParams.get("categories") || "general";
  const page = parseInt(url.searchParams.get("pageno") || "1", 10);

  const filtered = RESULTS.filter(
    (r) => r.category === category || category === "general",
  );
  let results;
  if (page === 1) results = filtered;
  else if (page === 2) results = filtered.slice(0, 2);
  else results = [];

  const body = {
    query: q,
    results,
    suggestions: ["linux kernel tutorial", "linux kernel modules"],
    number_of_results: 42,
    unresponsive_engines: [],
  };
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
});

server.listen(8080, "127.0.0.1", () => {
  console.log("Mock SearXNG listening on http://127.0.0.1:8080");
});
