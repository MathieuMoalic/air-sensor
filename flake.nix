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
  in {
    packages.${system} = {
      inherit codebase-memory-mcp kilo kilocode-cli;
    };

    devShells.${system}.default = pkgs.mkShell {
      packages = with pkgs;
        [
          python313
          uv

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
  };
}
