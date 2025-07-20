#!/bin/bash

# Script to copy contract ABIs to frontend

CONTRACTS_DIR="../contracts/out"
FRONTEND_ABI_DIR="../app/src/abi"

# Create ABI directory if it doesn't exist
mkdir -p $FRONTEND_ABI_DIR

# Copy ABI files
echo "Copying contract ABIs..."

# BondingCurveFactory
if [ -f "$CONTRACTS_DIR/BondingCurveFactory.sol/BondingCurveFactory.json" ]; then
  cp "$CONTRACTS_DIR/BondingCurveFactory.sol/BondingCurveFactory.json" "$FRONTEND_ABI_DIR/"
  echo "✓ Copied BondingCurveFactory ABI"
fi

# BondingCurve
if [ -f "$CONTRACTS_DIR/BondingCurve.sol/BondingCurve.json" ]; then
  cp "$CONTRACTS_DIR/BondingCurve.sol/BondingCurve.json" "$FRONTEND_ABI_DIR/"
  echo "✓ Copied BondingCurve ABI"
fi

# GraduationController
if [ -f "$CONTRACTS_DIR/GraduationController.sol/GraduationController.json" ]; then
  cp "$CONTRACTS_DIR/GraduationController.sol/GraduationController.json" "$FRONTEND_ABI_DIR/"
  echo "✓ Copied GraduationController ABI"
fi

echo "ABI copy complete!"