# S2 Parts Service

Microservice for managing parts, offers, and orders for DriveFix.

## 1. Role of the Service
S2 Parts is responsible for:
- Managing the catalogue of spare parts (CRUD).
- Managing supplier offers for specific parts.
- Managing customer orders.
- Providing an endpoint `/health` for Consul/Traefik.
- Enforcing security (JWT tokens from S1 and Role-based access).

## 2. Project Structure
```text
s2-parts/
│── pieces/
│   ├── models.py          # Piece, Offer, Order, SupplierReview
│   ├── views.py           # API endpoints
│   ├── serializers.py     # Data validation
│   ├── urls.py            # App routing
│   └── permissions.py     # Role checks
│
├── pieces_service/
│   ├── settings.py        # DRF, CORS, JWT config
│   └── urls.py            # Main routing (/api/v1/)
│
├── manage.py
├── requirements.txt
├── .env.example
└── README.md