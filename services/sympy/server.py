import math
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sympy import Eq, simplify, sympify
from sympy.core.relational import Relational
from sympy.parsing.sympy_parser import (
  implicit_multiplication_application,
  parse_expr,
  standard_transformations,
)

app = FastAPI(title="SymPy Validation Service")


class ValidationRequest(BaseModel):
  student_expression: str
  reference_expression: str
  variables: Optional[list[str]] = None
  expected_units: Optional[list[str]] = None


class ValidationResponse(BaseModel):
  equivalent: bool
  equivalence_detail: str
  units_match: bool
  units_detail: Optional[str] = None


@app.post("/validate", response_model=ValidationResponse)
async def validate_expression(payload: ValidationRequest) -> ValidationResponse:
  try:
    student = _normalize_expression(payload.student_expression)
    reference = _normalize_expression(payload.reference_expression)
  except Exception as error:  # noqa: broad-except
    raise HTTPException(status_code=400, detail=f"Failed to parse expressions: {error}")

  equivalent = _expressions_equivalent(student, reference)
  units_match, units_detail = _check_units(payload.student_expression, payload.expected_units)

  return ValidationResponse(
    equivalent=equivalent,
    equivalence_detail="Expressions are equivalent" if equivalent else "Expressions differ",
    units_match=units_match,
    units_detail=units_detail,
  )


@app.get("/health")
async def health() -> Dict[str, str]:
  return {"status": "ok"}


TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)


def _normalize_expression(expr: str):
  expr = expr.strip()
  if "=" in expr:
    left, right = expr.split("=", 1)
    left_expr = parse_expr(left, transformations=TRANSFORMATIONS)
    right_expr = parse_expr(right, transformations=TRANSFORMATIONS)
    return Eq(left_expr, right_expr)
  return parse_expr(expr, transformations=TRANSFORMATIONS)


def _expressions_equivalent(student: Any, reference: Any) -> bool:
  try:
    if isinstance(student, Relational) and isinstance(reference, Relational):
      diff = simplify(student.lhs - student.rhs - (reference.lhs - reference.rhs))
      return diff == 0
    if isinstance(student, Relational):
      student_diff = simplify(student.lhs - student.rhs)
      ref_diff = simplify(reference)
      return simplify(student_diff - ref_diff) == 0
    if isinstance(reference, Relational):
      student_expr = simplify(student)
      ref_diff = simplify(reference.lhs - reference.rhs)
      return simplify(student_expr - ref_diff) == 0
    diff = simplify(student - reference)
    return diff == 0
  except Exception:  # noqa: broad-except
    try:
      return math.isclose(float(student), float(reference), rel_tol=1e-9, abs_tol=1e-9)
    except Exception:  # noqa: broad-except
      return False


def _check_units(student_expression: str, expected_units: Optional[list[str]]):
  if not expected_units:
    return True, None
  normalized = student_expression.lower()
  for unit in expected_units:
    if unit.lower() in normalized:
      return True, None
  return False, f"Expected units: {', '.join(expected_units)}"
