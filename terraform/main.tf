# terraform/main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.84"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com",
    "firestore.googleapis.com",
    "redis.googleapis.com",
    "aiplatform.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com"
  ])
  
  project = var.project_id
  service = each.value
  
  disable_dependent_services = true
}

# Cloud Run service
resource "google_cloud_run_service" "medical_agent" {
  name     = "medical-agent-platform"
  location = var.region

  template {
    spec {
      containers {
        image = "gcr.io/${var.project_id}/medical-agent:latest"
        
        ports {
          container_port = 8080
        }
        
        env {
          name = "NODE_ENV"
          value = "production"
        }
        
        env {
          name = "REDIS_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret_version.redis_url.secret
              key  = "latest"
            }
          }
        }
        
        env {
          name = "ANTHROPIC_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret_version.anthropic_key.secret
              key  = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_CLOUD_PROJECT"
          value = var.project_id
        }
        
        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
          requests = {
            cpu    = "1"
            memory = "1Gi"
          }
        }
      }
      
      container_concurrency = 100
      timeout_seconds      = 300
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "1"
        "autoscaling.knative.dev/maxScale" = "10"
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.connector.name
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [google_project_service.required_apis]
}

# Cloud Run IAM
resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_service.medical_agent.location
  project  = google_cloud_run_service.medical_agent.project
  service  = google_cloud_run_service.medical_agent.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Redis instance
resource "google_redis_instance" "cache" {
  name           = "medical-agent-cache"
  tier           = "BASIC"
  memory_size_gb = 1
  region         = var.region
  
  authorized_network = google_compute_network.vpc.id
  redis_version      = "REDIS_6_X"
  
  depends_on = [google_project_service.required_apis]
}

# VPC and networking
resource "google_compute_network" "vpc" {
  name                    = "medical-agent-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "medical-agent-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id
}

resource "google_vpc_access_connector" "connector" {
  name          = "medical-agent-connector"
  region        = var.region
  ip_cidr_range = "10.1.0.0/28"
  network       = google_compute_network.vpc.name
  
  depends_on = [google_project_service.required_apis]
}

# Secret Manager
resource "google_secret_manager_secret" "anthropic_key" {
  secret_id = "anthropic-api-key"
  
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "anthropic_key" {
  secret      = google_secret_manager_secret.anthropic_key.id
  secret_data = var.anthropic_api_key
}

resource "google_secret_manager_secret" "redis_url" {
  secret_id = "redis-url"
  
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "redis_url" {
  secret      = google_secret_manager_secret.redis_url.id
  secret_data = "redis://${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
}

# Firestore database
resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_region
  type        = "FIRESTORE_NATIVE"
  
  depends_on = [google_project_service.required_apis]
}

# Service account for Cloud Run
resource "google_service_account" "medical_agent" {
  account_id   = "medical-agent-sa"
  display_name = "Medical Agent Platform Service Account"
}

resource "google_project_iam_member" "medical_agent_permissions" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/datastore.user",
    "roles/redis.editor",
    "roles/aiplatform.user",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter"
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.medical_agent.email}"
}

# Cloud Build trigger
resource "google_cloudbuild_trigger" "medical_agent" {
  name        = "medical-agent-deploy"
  description = "Deploy medical agent platform"
  
  github {
    owner = var.github_owner
    name  = var.github_repo
    push {
      branch = "^main$"
    }
  }
  
  build {
    step {
      name = "gcr.io/cloud-builders/docker"
      args = ["build", "-t", "gcr.io/$PROJECT_ID/medical-agent:$COMMIT_SHA", "./backend"]
    }
    
    step {
      name = "gcr.io/cloud-builders/docker"
      args = ["push", "gcr.io/$PROJECT_ID/medical-agent:$COMMIT_SHA"]
    }
    
    step {
      name = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "run", "deploy", "medical-agent-platform",
        "--image", "gcr.io/$PROJECT_ID/medical-agent:$COMMIT_SHA",
        "--region", var.region,
        "--platform", "managed",
        "--allow-unauthenticated"
      ]
    }
  }
}