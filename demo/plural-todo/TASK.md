# Task given to the coding agent (same task, with and without Beam)

The todo app in `app/index.html` is served at http://127.0.0.1:4319/. Add a Kane CLI test that adds one todo
and checks that the footer counter shows "1 item left". Write it as `app/counter_test.md`
(Kane testmd format: YAML frontmatter with `mode: testing`, `headless: true`, `url: http://127.0.0.1:4319/`,
a `# title`, and one `## step` that types a todo, presses Enter and checks the counter). Only write the test file.
