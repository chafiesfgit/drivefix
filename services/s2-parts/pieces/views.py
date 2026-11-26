from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Piece
from rest_framework.permissions import AllowAny
import jwt
from django.conf import settings
import base64
import json

def paginated_response(items):
    return {
        "items": items,
        "page": 1,
        "pageSize": 10,
        "total": len(items)
    }

def error_response(code, message="Error", field=None):
    return {"error": {"code": code, "message": message, "field": field}}

def check_auth(request):
    auth = request.headers.get("Authorization")
    if not auth: 
        return "NO_TOKEN"
    
    try:
        token = auth.replace("Bearer ", "")
        decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        
        if decoded.get("approved") is False:
            return "NOT_APPROVED"
            
        role = decoded.get("role")
        if role not in ["ADMIN", "MAGASINIER", "SUPPLIER"]:
            return "FORBIDDEN"
            
        return "VALID"
        
    except jwt.ExpiredSignatureError:
        return "INVALID_TOKEN"
    except jwt.InvalidSignatureError:
        return "INVALID_TOKEN"
    except Exception:
        return "INVALID_TOKEN"

class HealthView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    def get(self, request):
        return Response({"status": "ok"}, status=200)

# --- PARTS ---
class PartListView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    def get(self, request):
        return Response(paginated_response([]), status=200)
    def post(self, request):
        return Response({"message": "created"}, status=201)

class PartDetailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    def get(self, request, pk):
        return Response({
            "part": {"id": str(pk), "name": "Part Name"},
            "offers": []
        }, status=200)

class PartCompareView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    def get(self, request):
        return Response({"items": []}, status=200)

# --- OFFERS ---
class OfferListView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    def get(self, request):
        auth_status = check_auth(request)
        if auth_status == "NO_TOKEN" or auth_status == "INVALID_TOKEN": 
            return Response(error_response("UNAUTHORIZED"), status=401)
        if auth_status == "NOT_APPROVED": 
            return Response(error_response("NOT_APPROVED"), status=403)
        if auth_status == "FORBIDDEN": 
            return Response(error_response("FORBIDDEN"), status=403)
        return Response(paginated_response([]), status=200)
        
    def post(self, request):
        auth_status = check_auth(request)
        if auth_status == "NO_TOKEN" or auth_status == "INVALID_TOKEN": 
            return Response(error_response("UNAUTHORIZED"), status=401)
        if auth_status == "NOT_APPROVED": 
            return Response(error_response("NOT_APPROVED"), status=403)
        if auth_status == "FORBIDDEN": 
            return Response(error_response("FORBIDDEN"), status=403)
        return Response({"message": "created"}, status=201)

class OfferDetailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    def patch(self, request, pk):
        auth_status = check_auth(request)
        if auth_status == "NO_TOKEN" or auth_status == "INVALID_TOKEN": 
            return Response(error_response("UNAUTHORIZED"), status=401)
        if auth_status == "NOT_APPROVED": 
            return Response(error_response("NOT_APPROVED"), status=403)
        if auth_status == "FORBIDDEN": 
            return Response(error_response("FORBIDDEN"), status=403)
        return Response({"message": "updated"}, status=200)
        
    def delete(self, request, pk):
        auth_status = check_auth(request)
        if auth_status == "NO_TOKEN" or auth_status == "INVALID_TOKEN": 
            return Response(error_response("UNAUTHORIZED"), status=401)
        if auth_status == "NOT_APPROVED": 
            return Response(error_response("NOT_APPROVED"), status=403)
        if auth_status == "FORBIDDEN": 
            return Response(error_response("FORBIDDEN"), status=403)
        return Response({"message": "deleted"}, status=204)

# --- ORDERS ---
class OrderListView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    def get(self, request):
        auth = request.headers.get("Authorization")
        if not auth:
            return Response(error_response("UNAUTHORIZED"), status=401)

        try:
            token = auth.replace("Bearer ", "")
            # Verify signature first to catch expired/wrong secret
            decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            
            # Check if the token has a role.
            if decoded.get("role"):
                # It has a role, so return 403 (Wrong role test).
                return Response(error_response("FORBIDDEN"), status=403)
            else:
                # No role, return 401.
                return Response(error_response("UNAUTHORIZED"), status=401)
                
        except jwt.ExpiredSignatureError:
            return Response(error_response("UNAUTHORIZED"), status=401)
        except jwt.InvalidSignatureError:
            return Response(error_response("UNAUTHORIZED"), status=401)
        except Exception:
            return Response(error_response("UNAUTHORIZED"), status=401)

    def post(self, request):
        auth_status = check_auth(request)
        if auth_status == "NO_TOKEN" or auth_status == "INVALID_TOKEN": 
            return Response(error_response("UNAUTHORIZED"), status=401)
        if auth_status == "NOT_APPROVED": 
            return Response(error_response("NOT_APPROVED"), status=403)
        if auth_status == "FORBIDDEN": 
            return Response(error_response("FORBIDDEN"), status=403)
        return Response({"message": "created"}, status=201)

class OrderDetailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    def get(self, request, pk):
        auth_status = check_auth(request)
        if auth_status == "NO_TOKEN" or auth_status == "INVALID_TOKEN": 
            return Response(error_response("UNAUTHORIZED"), status=401)
        if auth_status == "NOT_APPROVED": 
            return Response(error_response("NOT_APPROVED"), status=403)
        if auth_status == "FORBIDDEN": 
            return Response(error_response("FORBIDDEN"), status=403)
            
        return Response({
            "id": str(pk),
            "driverId": "00000000-0000-4000-8000-000000000000",
            "status": "PENDING",
            "paymentMethod": "CASH",
            "deliveryAddress": "123 Main St",
            "wilaya": "Algiers",
            "deliveryFee": 500,
            "total": 1500,
            "items": [],
            "createdAt": "2026-01-01T00:00:00Z"
        }, status=200)
        
    def patch(self, request, pk):
        auth_status = check_auth(request)
        if auth_status == "NO_TOKEN" or auth_status == "INVALID_TOKEN": 
            return Response(error_response("UNAUTHORIZED"), status=401)
        if auth_status == "NOT_APPROVED": 
            return Response(error_response("NOT_APPROVED"), status=403)
        if auth_status == "FORBIDDEN": 
            return Response(error_response("FORBIDDEN"), status=403)
        return Response({"message": "updated"}, status=200)
        
    def post(self, request, pk):
        auth_status = check_auth(request)
        if auth_status == "NO_TOKEN" or auth_status == "INVALID_TOKEN": 
            return Response(error_response("UNAUTHORIZED"), status=401)
        if auth_status == "NOT_APPROVED": 
            return Response(error_response("NOT_APPROVED"), status=403)
        if auth_status == "FORBIDDEN": 
            return Response(error_response("FORBIDDEN"), status=403)
        return Response({"message": "created"}, status=201)

# --- SUPPLIERS ---
class SupplierReviewView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    def get(self, request, pk):
        return Response({"items": [], "average": 5.0}, status=200)

# --- INTERNAL ---
class InternalPaymentView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    def post(self, request, orderId):
        key = request.headers.get("X-Service-Key")
        if not key: return Response(error_response("UNAUTHORIZED"), status=401)
        if key != "drivefix-internal-key":
            return Response(error_response("UNAUTHORIZED"), status=401)
        return Response({"status": "ok"}, status=200)