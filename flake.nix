{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    llm-agents.url = "github:numtide/llm-agents.nix";
  };

  outputs = {
    nixpkgs,
    llm-agents,
    ...
  }: let
    system = "x86_64-linux";

    pkgs = import nixpkgs {
      inherit system;
    };

    codebase-memory-mcp = pkgs.stdenvNoCC.mkDerivation rec {
      pname = "codebase-memory-mcp";
      version = "0.8.1";

      src = pkgs.fetchurl {
        url = "https://github.com/DeusData/codebase-memory-mcp/releases/download/v${version}/codebase-memory-mcp-linux-amd64.tar.gz";
        hash = "sha256-29O5Lqhw7yQLYwWfJr2hUBX3bvmXiTG+vDoPnQlHCXM=";
      };

      nativeBuildInputs = with pkgs; [
        gnutar
        gzip
      ];

      dontUnpack = true;
      dontConfigure = true;
      dontBuild = true;

      installPhase = ''
        runHook preInstall

        mkdir -p "$out/bin" "$TMPDIR/unpack"
        tar -xzf "$src" -C "$TMPDIR/unpack"

        install -Dm755 \
          "$(find "$TMPDIR/unpack" -type f -name codebase-memory-mcp -print -quit)" \
          "$out/bin/codebase-memory-mcp"

        runHook postInstall
      '';

      meta = {
        description = "High-performance code intelligence MCP server";
        homepage = "https://github.com/DeusData/codebase-memory-mcp";
        platforms = ["x86_64-linux"];
      };
    };

    kilocode-cli = llm-agents.packages.${system}.kilocode-cli;

    kilo =
      pkgs.runCommand "kilo-wrapper" {
        nativeBuildInputs = [pkgs.makeWrapper];
      } ''
        mkdir -p "$out/bin"

        makeWrapper "${kilocode-cli}/bin/kilocode" "$out/bin/kilo"
        ln -s "${kilocode-cli}/bin/kilocode" "$out/bin/kilocode"
      '';

    webPackage = (pkgs.buildNpmPackage.override {nodejs = pkgs.nodejs_22;}) {
      pname = "air";
      version = "0.1.0";
      src = ./web;
      npmDepsHash = "sha256-Dv9/ie8mshHEu6PIudXI1AN/d0/vZSVhxS8cUne7+80=";

      npmDepsFetcherVersion = 2;

      nativeBuildInputs = [
        pkgs.python3
        pkgs.gcc
      ];

      npmBuildScript = "build";

      installPhase = ''
        runHook preInstall

        mkdir -p $out/lib/air
        cp -r build/* $out/lib/air/

        # adapter-node keeps better-sqlite3 in node_modules; copy it so the
        # native addon is resolvable at runtime.
        cp -r node_modules $out/lib/air/node_modules

        mkdir -p $out/bin
        cat > $out/bin/air <<EOF
        #!${pkgs.runtimeShell}
        exec ${pkgs.nodejs_22}/bin/node $out/lib/air/index.js "\$@"
        EOF
        chmod +x $out/bin/air

        runHook postInstall
      '';

      meta = {
        description = "Air web server (SvelteKit adapter-node)";
        homepage = "https://github.com/MathieuMoalic/air";
        platforms = ["x86_64-linux"];
      };
    };

    service = {
      lib,
      config,
      pkgs,
      ...
    }: let
      cfg = config.services.air;
    in {
      options.services.air = {
        enable = lib.mkEnableOption "Air dashboard (SvelteKit adapter-node)";

        package = lib.mkOption {
          type = lib.types.package;
          default = webPackage;
          description = "The air package to use.";
        };

        bindAddr = lib.mkOption {
          type = lib.types.str;
          default = "127.0.0.1:3000";
          description = "Address (HOST:PORT) the node server binds to";
        };

        metricsUrl = lib.mkOption {
          type = lib.types.str;
          default = "http://192.168.1.50/metrics";
          description = "ESPHome Prometheus metrics endpoint to poll";
        };

        pollIntervalMs = lib.mkOption {
          type = lib.types.ints.positive;
          default = 7 * 60 * 1000;
          description = "Polling interval in milliseconds";
        };

        fetchTimeoutMs = lib.mkOption {
          type = lib.types.ints.positive;
          default = 5000;
          description = "HTTP fetch timeout in milliseconds";
        };

        databasePath = lib.mkOption {
          type = lib.types.str;
          default = "/var/lib/air/air.sqlite";
          description = "Path to the SQLite database file";
        };
      };

      config = lib.mkIf cfg.enable {
        users.users.air = {
          isSystemUser = true;
          group = "air";
          home = "/var/lib/air";
          createHome = true;
        };
        users.groups.air = {};

        systemd.tmpfiles.rules = [
          "d ${lib.dirOf cfg.databasePath} 0750 air air - -"
        ];

        systemd.services.air = {
          description = "Air dashboard";
          after = ["network.target"];
          wantedBy = ["multi-user.target"];

          environment = let
            parts = lib.splitString ":" cfg.bindAddr;
            host = lib.head parts;
            port = lib.last parts;
          in {
            HOST = host;
            PORT = port;
            METRICS_URL = cfg.metricsUrl;
            POLL_INTERVAL_MS = toString cfg.pollIntervalMs;
            FETCH_TIMEOUT_MS = toString cfg.fetchTimeoutMs;
            DB_PATH = cfg.databasePath;
          };

          serviceConfig = {
            WorkingDirectory = "/var/lib/air";
            User = "air";
            Group = "air";
            StateDirectory = "air";
            Restart = "always";
            RestartSec = "5s";
            NoNewPrivileges = "yes";
            PrivateTmp = "yes";
            ProtectSystem = "strict";
            ReadWritePaths = [(lib.dirOf cfg.databasePath)];
            SocketBindAllow = let
              port = lib.last (lib.splitString ":" cfg.bindAddr);
            in ["tcp:${port}"];
            SocketBindDeny = "any";
          };
        };
      };
    };
  in {
    devShells.${system}.default = pkgs.mkShell {
      packages = with pkgs;
        [
          python313
          uv

          nodejs_22
          pnpm

          curl
          cacert
          git
          jq
          gnutar
          gzip
          zstd

          gcc
          zlib
          openssl
          libffi

          just
        ]
        ++ [
          codebase-memory-mcp
          kilo
        ];

      LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
        pkgs.stdenv.cc.cc.lib
        pkgs.zlib
        pkgs.openssl
        pkgs.libffi
      ];

      shellHook = ''
        if [ -d "$PWD/.venv/bin" ]; then
          export PATH="$PWD/.venv/bin:$PATH"
        fi
        export CBM_CACHE_DIR="$PWD/.cache/codebase-memory-mcp"
      '';
    };

    packages.${system} = {
      inherit codebase-memory-mcp kilo kilocode-cli;
      default = webPackage;
      web = webPackage;
    };

    nixosModules.air-service = service;
  };
}
