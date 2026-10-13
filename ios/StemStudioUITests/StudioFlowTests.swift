import XCTest

final class StudioFlowTests: XCTestCase {
    func testLiveLoginAndPlayerControls() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        let password = app.secureTextFields["login.password"]
        if password.waitForExistence(timeout: 10) {
            let credential = try XCTUnwrap(ProcessInfo.processInfo.environment["STUDIO_TEST_PASSWORD"], "Live credential must be supplied outside the repository")
            password.tap()
            password.typeText(credential)
            XCTAssertTrue(app.buttons["login.submit"].isEnabled)
            app.buttons["login.submit"].tap()
        }
        XCTAssertTrue(app.navigationBars["stem studio"].waitForExistence(timeout: 20))
        let song = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Carefree")).firstMatch
        if !song.isHittable { app.swipeUp() }
        XCTAssertTrue(song.waitForExistence(timeout: 10))
        song.tap()
        let play = app.buttons["player.play"]
        XCTAssertTrue(play.waitForExistence(timeout: 15))
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: play)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
        play.tap()
        XCTAssertTrue(app.buttons["Pozastavit"].waitForExistence(timeout: 5))
        app.buttons["Solo Zpěv"].tap()
        XCTAssertTrue(app.buttons["Pozastavit"].exists)
        app.buttons["Pozastavit"].tap()
        XCTAssertTrue(app.buttons["Přehrát"].exists)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Native iPhone player"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}
