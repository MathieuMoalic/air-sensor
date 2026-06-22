{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = {nixpkgs, ...}: let
    system = "x86_64-linux";
    pkgs = import nixpkgs {
      inherit system;
    };

    shell = pkgs.mkShell {
      name = "dev-shell";
      packages = with pkgs; [
        just
        uv
      ];
    };
  in {
    devShells.${system}.default = shell;
  };
}
