#!/usr/bin/env bash

echo '#!/usr/bin/env node' | cat - dist/main.js > temp && mv temp dist/main.js
