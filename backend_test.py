#!/usr/bin/env python3

import requests
import sys
import json
import time
from datetime import datetime

class KiteTriviaAPITester:
    def __init__(self, base_url="https://kite-trivia-quest.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session = requests.Session()  # Use session to handle cookies
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, status, message="", response_data=None):
        """Log test results"""
        self.tests_run += 1
        if status == "PASS":
            self.tests_passed += 1
            print(f"✅ {name}: {message}")
        else:
            print(f"❌ {name}: {message}")
        
        self.test_results.append({
            "test": name,
            "status": status,
            "message": message,
            "response_data": response_data
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        
        # Set default headers
        if headers is None:
            headers = {}
        headers['Content-Type'] = 'application/json'

        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)

            success = response.status_code == expected_status
            response_data = None
            
            try:
                response_data = response.json()
            except:
                response_data = response.text

            if success:
                self.log_test(name, "PASS", f"Status: {response.status_code}", response_data)
                return True, response_data
            else:
                self.log_test(name, "FAIL", f"Expected {expected_status}, got {response.status_code}. Response: {response_data}")
                return False, response_data

        except Exception as e:
            self.log_test(name, "FAIL", f"Exception: {str(e)}")
            return False, None

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        self.run_test("API Root", "GET", "", 200)
        self.run_test("Health Check", "GET", "health", 200)

    def test_user_registration(self):
        """Test user registration"""
        print("\n🔍 Testing User Registration...")
        
        timestamp = int(time.time())
        user_data = {
            "email": f"testuser{timestamp}@example.com",
            "password": "testpass123",
            "name": "Test User"
        }
        
        success, response = self.run_test("User Registration", "POST", "auth/register", 200, user_data)
        if success and response:
            self.user_data = response
            print(f"   Registered user: {response.get('name')} ({response.get('email')})")
            return True
        return False

    def test_user_login(self):
        """Test user login with the registered user"""
        print("\n🔍 Testing User Login...")
        
        if not self.user_data:
            self.log_test("Login Test", "SKIP", "No user registered to test with")
            return False
            
        # Use the same credentials from registration
        login_data = {
            "email": self.user_data["email"],
            "password": "testpass123"
        }
        
        success, response = self.run_test("User Login", "POST", "auth/login", 200, login_data)
        if success and response:
            self.user_data = response
            return True
        return False

    def test_get_current_user(self):
        """Test getting current user info"""
        print("\n🔍 Testing Get Current User...")
        
        success, response = self.run_test("Get Current User", "GET", "auth/me", 200)
        return success

    def test_trivia_questions(self):
        """Test trivia questions endpoints"""
        print("\n🔍 Testing Trivia Questions...")
        
        # Get questions with different difficulties
        success, response = self.run_test("Get Questions (Difficulty 1)", "GET", "questions?difficulty=1&limit=5", 200)
        self.run_test("Get Questions (Difficulty 2)", "GET", "questions?difficulty=2&limit=5", 200)
        self.run_test("Get Questions (Difficulty 3)", "GET", "questions?difficulty=3&limit=5", 200)
        
        # Check if questions are from multiple categories
        if success and response and len(response) > 0:
            categories = set([q.get("category") for q in response])
            if len(categories) > 1:
                self.log_test("Multiple Categories", "PASS", f"Questions from {len(categories)} categories: {categories}")
            else:
                self.log_test("Multiple Categories", "INFO", f"Questions from {len(categories)} category: {categories}")
            
            question = response[0]
            
            # Test answer submission
            answer_data = {
                "question_id": question["question_id"],
                "selected_answer": question["correct_answer"]
            }
            
            self.run_test("Submit Correct Answer", "POST", "questions/answer", 200, answer_data)
            
            # Test wrong answer
            wrong_answer = (question["correct_answer"] + 1) % len(question["options"])
            answer_data["selected_answer"] = wrong_answer
            self.run_test("Submit Wrong Answer", "POST", "questions/answer", 200, answer_data)
        
        return success

    def test_characters(self):
        """Test character endpoints"""
        print("\n🔍 Testing Characters...")
        
        # Get all characters
        success, response = self.run_test("Get All Characters", "GET", "characters", 200)
        
        # Get characters by category
        self.run_test("Get Kites", "GET", "characters?category=kite", 200)
        self.run_test("Get Companions", "GET", "characters?category=companion", 200)
        self.run_test("Get Sky Themes", "GET", "characters?category=sky_theme", 200)
        
        if success and response and len(response) > 0:
            # Test equip kite (should have basic_kite)
            equip_data = {"character_id": "basic_kite", "type": "kite"}
            self.run_test("Equip Kite", "POST", "characters/equip", 200, equip_data)
            
            # Test equip companion (user should have dawn sky theme by default)
            equip_data = {"character_id": "dawn", "type": "sky_theme"}
            self.run_test("Equip Sky Theme", "POST", "characters/equip", 200, equip_data)
            
            # Test equip companion with None (unequip)
            equip_data = {"character_id": None, "type": "companion"}
            self.run_test("Unequip Companion", "POST", "characters/equip", 200, equip_data)
            
            # Test purchase character (find one that's available at level 1 or free)
            for char in response:
                if char["price"] > 0 and char["unlock_level"] <= 1:
                    purchase_data = {"character_id": char["character_id"]}
                    success, response_data = self.run_test("Purchase Character", "POST", "characters/purchase", 200, purchase_data)
                    if not success and response_data and "Requires level" in str(response_data.get("detail", "")):
                        self.log_test("Purchase Character Level Check", "PASS", "Correctly blocked low-level user from purchasing")
                    break
            else:
                # Try any paid character to test level requirement enforcement
                for char in response:
                    if char["price"] > 0:
                        purchase_data = {"character_id": char["character_id"]}
                        success, response_data = self.run_test("Purchase Character Level Block", "POST", "characters/purchase", 403, purchase_data)
                        break
        
        return success

    def test_leaderboard(self):
        """Test leaderboard endpoints"""
        print("\n🔍 Testing Leaderboard...")
        
        self.run_test("Get Leaderboard", "GET", "leaderboard", 200)
        self.run_test("Get My Rank", "GET", "leaderboard/my-rank", 200)

    def test_profile(self):
        """Test profile endpoint"""
        print("\n🔍 Testing Profile...")
        
        self.run_test("Get Profile", "GET", "profile", 200)
    
    def test_daily_rewards(self):
        """Test daily reward endpoints"""
        print("\n🔍 Testing Daily Rewards...")
        
        success, response = self.run_test("Get Daily Reward Status", "GET", "daily-reward", 200)
        
        if success and response:
            if response.get("can_claim"):
                self.run_test("Claim Daily Reward", "POST", "daily-reward/claim", 200)
            else:
                self.log_test("Daily Reward Already Claimed", "INFO", "Reward already claimed today")
        
        return success

    def test_logout(self):
        """Test logout"""
        print("\n🔍 Testing Logout...")
        
        self.run_test("Logout", "POST", "auth/logout", 200)

    def run_all_tests(self):
        """Run all API tests"""
        print(f"🚀 Starting Kite Trivia API Tests...")
        print(f"🌐 Base URL: {self.base_url}")
        
        # Run tests in order
        self.test_health_endpoints()
        
        if self.test_user_registration():
            self.test_get_current_user()
            self.test_trivia_questions()
            self.test_characters()
            self.test_leaderboard()
            self.test_profile()
            self.test_daily_rewards()
            self.test_logout()
        else:
            print("❌ Registration failed, skipping authenticated tests")
        
        # Summary
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

    def get_results_summary(self):
        """Return test results summary"""
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            "test_details": self.test_results
        }

def main():
    tester = KiteTriviaAPITester()
    exit_code = tester.run_all_tests()
    
    # Save results to file
    results = tester.get_results_summary()
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())