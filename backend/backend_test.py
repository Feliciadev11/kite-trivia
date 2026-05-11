import requests
import sys
from datetime import datetime
import json

class KiteTriviaAPITester:
    def __init__(self, base_url="https://kite-trivia-quest.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                self.test_results.append({"test": name, "status": "PASSED", "code": response.status_code})
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.test_results.append({"test": name, "status": "FAILED", "code": response.status_code, "expected": expected_status})

            try:
                return success, response.json() if response.text else {}
            except:
                return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({"test": name, "status": "ERROR", "error": str(e)})
            return False, {}

    def test_health(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success

    def test_register(self, email, password, name):
        """Test user registration"""
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={"email": email, "password": password, "name": name}
        )
        if success and 'user_id' in response:
            self.user_id = response['user_id']
            print(f"   User ID: {self.user_id}")
            return True
        return False

    def test_login(self, email, password):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'user_id' in response:
            self.user_id = response['user_id']
            print(f"   User ID: {self.user_id}")
            return True
        return False

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        if success:
            print(f"   User: {response.get('name')} (Level {response.get('level')})")
        return success

    def test_get_questions(self, difficulty=1, limit=10):
        """Test get questions"""
        success, response = self.run_test(
            "Get Questions",
            "GET",
            "questions",
            200,
            params={"difficulty": difficulty, "limit": limit}
        )
        if success:
            print(f"   Retrieved {len(response)} questions")
            if len(response) > 0:
                print(f"   Sample question: {response[0].get('question')[:50]}...")
                print(f"   Categories: {set([q.get('category') for q in response])}")
            return response
        return []

    def test_submit_answer(self, question_id, selected_answer):
        """Test submit answer"""
        success, response = self.run_test(
            "Submit Answer",
            "POST",
            "questions/answer",
            200,
            data={"question_id": question_id, "selected_answer": selected_answer}
        )
        if success:
            print(f"   Correct: {response.get('correct')}, XP Earned: {response.get('xp_earned')}")
        return success, response

    def test_get_characters(self):
        """Test get characters"""
        success, response = self.run_test(
            "Get Characters",
            "GET",
            "characters",
            200
        )
        if success:
            print(f"   Retrieved {len(response)} characters")
            if len(response) > 0:
                print(f"   Sample: {response[0].get('name')} (Level {response[0].get('unlock_level')})")
        return success, response

    def test_get_leaderboard(self):
        """Test get leaderboard"""
        success, response = self.run_test(
            "Get Leaderboard",
            "GET",
            "leaderboard",
            200
        )
        if success:
            print(f"   Retrieved {len(response)} leaderboard entries")
        return success

    def test_daily_reward_status(self):
        """Test daily reward status"""
        success, response = self.run_test(
            "Daily Reward Status",
            "GET",
            "daily-reward",
            200
        )
        if success:
            print(f"   Can Claim: {response.get('can_claim')}, Streak: {response.get('current_streak')}")
        return success, response

    def test_claim_daily_reward(self):
        """Test claim daily reward"""
        success, response = self.run_test(
            "Claim Daily Reward",
            "POST",
            "daily-reward/claim",
            200
        )
        if success:
            print(f"   XP Earned: {response.get('xp_earned')}, New Streak: {response.get('new_streak')}")
        return success, response

    def test_get_profile(self):
        """Test get profile"""
        success, response = self.run_test(
            "Get Profile",
            "GET",
            "profile",
            200
        )
        if success:
            print(f"   Accuracy: {response.get('accuracy')}%, XP Progress: {response.get('xp_progress'):.1f}%")
        return success

    def test_logout(self):
        """Test logout"""
        success, response = self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )
        return success

def main():
    print("=" * 60)
    print("KITE TRIVIA API TEST SUITE")
    print("=" * 60)
    
    tester = KiteTriviaAPITester()
    test_timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    test_email = f"test_user_{test_timestamp}@test.com"
    test_password = "TestPass123!"
    test_name = f"Test User {test_timestamp}"

    # Test 1: Health Check
    if not tester.test_health():
        print("\n❌ Health check failed, stopping tests")
        return 1

    # Test 2: User Registration
    if not tester.test_register(test_email, test_password, test_name):
        print("\n❌ Registration failed, stopping tests")
        return 1

    # Test 3: Get Current User
    if not tester.test_get_me():
        print("\n❌ Get current user failed")

    # Test 4: Get Questions (test randomization)
    questions = tester.test_get_questions(difficulty=1, limit=10)
    if not questions:
        print("\n❌ Failed to get questions")
    else:
        # Verify we have questions from multiple categories
        categories = set([q.get('category') for q in questions])
        print(f"\n📊 Question categories found: {categories}")
        if len(categories) < 2:
            print("⚠️  Warning: Expected questions from multiple categories")

    # Test 5: Submit Answer
    if questions:
        first_question = questions[0]
        # Submit correct answer
        success, result = tester.test_submit_answer(
            first_question['question_id'],
            first_question['correct_answer']
        )
        if not success:
            print("\n❌ Failed to submit answer")

    # Test 6: Get Characters
    success, characters = tester.test_get_characters()
    if not success:
        print("\n❌ Failed to get characters")
    else:
        # Verify we have 10 characters
        if len(characters) != 10:
            print(f"⚠️  Warning: Expected 10 characters, got {len(characters)}")

    # Test 7: Get Leaderboard
    if not tester.test_get_leaderboard():
        print("\n❌ Failed to get leaderboard")

    # Test 8: Daily Reward Status
    success, reward_status = tester.test_daily_reward_status()
    if not success:
        print("\n❌ Failed to get daily reward status")

    # Test 9: Claim Daily Reward (if available)
    if success and reward_status.get('can_claim'):
        success, claim_result = tester.test_claim_daily_reward()
        if not success:
            print("\n❌ Failed to claim daily reward")
        else:
            # Verify streak incremented
            if claim_result.get('new_streak') != 1:
                print(f"⚠️  Warning: Expected streak to be 1, got {claim_result.get('new_streak')}")

    # Test 10: Get Profile
    if not tester.test_get_profile():
        print("\n❌ Failed to get profile")

    # Test 11: Logout
    if not tester.test_logout():
        print("\n❌ Failed to logout")

    # Print summary
    print("\n" + "=" * 60)
    print(f"📊 TESTS SUMMARY: {tester.tests_passed}/{tester.tests_run} PASSED")
    print("=" * 60)
    
    # Print detailed results
    print("\nDetailed Results:")
    for result in tester.test_results:
        status_icon = "✅" if result['status'] == "PASSED" else "❌"
        print(f"{status_icon} {result['test']}: {result['status']}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
