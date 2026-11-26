from django.urls import path
from .views import (
    HealthView, PartListView, PartDetailView, PartCompareView, 
    OfferListView, OfferDetailView, OrderListView, OrderDetailView, 
    SupplierReviewView, InternalPaymentView
)

urlpatterns = [
    path('health', HealthView.as_view(), name='health'),
    
    path('parts', PartListView.as_view(), name='parts_list'),
    path('parts/compare', PartCompareView.as_view(), name='parts_compare'),
    path('parts/<str:pk>', PartDetailView.as_view(), name='part_detail'),
    
    path('offers', OfferListView.as_view(), name='offers_list'),
    path('offers/<str:pk>', OfferDetailView.as_view(), name='offer_detail'),
    
    path('orders', OrderListView.as_view(), name='orders_list'),
    path('orders/<str:pk>', OrderDetailView.as_view(), name='order_detail'),
    path('orders/<str:pk>/status', OrderDetailView.as_view(), name='order_status'),
    path('orders/<str:pk>/review', OrderDetailView.as_view(), name='order_review'),
    
    path('suppliers/<str:pk>/reviews', SupplierReviewView.as_view(), name='supplier_reviews'),
    
    path('internal/payments/<str:orderId>/result', InternalPaymentView.as_view(), name='internal_payment'),
]